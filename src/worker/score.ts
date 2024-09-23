import type {Index} from 'lunr';
import type {Position} from '../types';

import {INDEX_FIELDS, MERGE_TOLERANCE} from '../constants';

type ResultToken = {
    text: string;
    position: Position;
    boost: number;
};

type ScoreState = {
    score: number;
    prev: ResultToken | null | undefined;
    curr: ResultToken;
    phrase: string;
    position: Position;
};

type ScoreResult = {
    score: number;
    position: Position;
};

export type Score = {
    positions: Position[];
    avgScore: number;
    sumScore: number;
    maxScore: number;
    maxScorePosition: Position;
};

type FSM = () => FSM | null;

export function score(terms: string[], results: Index.Result) {
    const phrase = terms.join(' ');
    const fields = normalize(results);
    const scores: Record<string, Score> = {};

    let state: ScoreState, tokens: ResultToken[];
    let result: ScoreResult[];
    for (const [field] of Object.entries(INDEX_FIELDS)) {
        tokens = fields[field];
        result = [];

        if (!tokens.length) {
            continue;
        }

        let action: FSM | null = start;
        while (action) {
            action = action();
        }

        scores[field] = {
            positions: result.map(get('position')),
            avgScore: result.map(get('score')).reduce(avg, 0),
            sumScore: result.map(get('score')).reduce(sum, 0),
            maxScore: result.map(get('score')).reduce(max, 0),
            maxScorePosition: result.reduce(maxScorePosition).position,
        };
    }

    return scores;

    function start() {
        const token = tokens.shift() as ResultToken;

        state = {
            score: 0,
            prev: null,
            curr: token,
            position: token.position.slice() as Position,
            phrase: token.text,
        };

        return match;
    }

    function nextScore() {
        const {score, position} = state;
        result.push({score, position});

        state.score = 0;
        state.position = state.curr.position.slice() as Position;
        state.phrase = state.curr.text;

        if (!tokens.length) {
            return end;
        }

        return nextToken;
    }

    function nextToken() {
        if (!tokens.length) {
            return nextScore;
        }

        state.prev = state.curr;
        state.curr = tokens.shift() as ResultToken;
        state.phrase += ' ' + state.curr.text;

        return match;
    }

    function match() {
        if (terms.includes(state.curr.text as string)) {
            return scoreToken;
        } else {
            return scoreWildcard;
        }
    }

    function scoreToken() {
        if (!state.prev) {
            state.score += 2;
            return nextToken;
        }

        // This is partially buggy, if phrase has more that one similar token
        if (distance(state.prev.position, state.curr.position) <= MERGE_TOLERANCE) {
            state.score += phrase.includes(state.phrase) ? 10 : 2;
            state.position[1] = state.curr.position[1];
            return nextToken;
        }

        return nextScore;
    }

    function scoreWildcard() {
        if (!state.prev) {
            state.score += 0.5;
        } else if (distance(state.prev.position, state.curr.position) <= MERGE_TOLERANCE) {
            state.score += phrase.includes(state.phrase) ? 1 : 0.5;
            state.position[1] = state.curr.position[1];
        }

        return nextScore;
    }

    function end() {
        return null;
    }
}

function get<F extends string>(field: F) {
    return function <T extends {[prop in F]: unknown}>(object: T) {
        return object[field];
    };
}

function max(a: number, b: number) {
    return Math.max(a, b);
}

function avg(a: number, b: number) {
    return (a + b) / 2;
}

function sum(a: number, b: number) {
    return a + b;
}

function maxScorePosition(a: ScoreResult, b: ScoreResult) {
    return a.score >= b.score ? a : b;
}

function distance(prev: Position, next: Position) {
    return next[0] - prev[1];
}

function normalize(result: Index.Result): Record<string, ResultToken[]> {
    const fields: Record<string, ResultToken[]> = {};

    for (const [field, boost] of Object.entries(INDEX_FIELDS)) {
        fields[field] = [];

        for (const [text, entry] of Object.entries(result.matchData.metadata)) {
            if (entry[field]) {
                for (const [start, count] of entry[field].position) {
                    fields[field].push({text, position: [start, start + count], boost});
                }
            }
        }

        fields[field].sort((a, b) => a.position[0] - b.position[0]);
    }

    return fields;
}
