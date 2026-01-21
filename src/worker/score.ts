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
    phrase: string[];
    position: Position;
};

type ScoreResult = {
    score: number;
    position: Position;
    phrase: string;
};

export type Score = {
    positions: Position[];
    score: number;
    position: Position;
};

type FSM = () => FSM | null;

export function sparsed(result: Index.Result) {
    const fields = normalize(result);
    const scores: Record<string, Score> = {};

    for (const [field] of Object.entries(INDEX_FIELDS)) {
        const tokens = fields[field];

        if (!tokens.length) {
            continue;
        }

        scores[field] = {
            positions: tokens.map(get('position')),
            score: result.score,
            position: tokens[0].position,
        };
    }

    return scores;
}

export function phrased(result: Index.Result, terms: string[]) {
    const phrase = terms.join(' ');
    const fields = normalize(result);
    const scores: Record<string, Score> = {};

    let state: ScoreState, tokens: ResultToken[];
    let results: ScoreResult[];
    for (const [field] of Object.entries(INDEX_FIELDS)) {
        tokens = fields[field];
        results = [];

        if (!tokens.length) {
            continue;
        }

        let action: FSM | null = start;
        while (action) {
            action = action();
        }

        scores[field] = {
            positions: results.map(get('position')),
            score: results.map(get('score')).reduce(max, 0),
            position: results.reduce(maxScorePosition).position,
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
            phrase: [token.text],
        };

        return match;
    }

    function nextScore() {
        const {score, position} = state;
        results.push({score, position, phrase});

        state.score = 0;
        state.position = state.curr.position.slice() as Position;
        state.phrase = [state.curr.text];

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
        state.phrase.push(state.curr.text);

        return match;
    }

    function match() {
        const {prev, curr} = state;

        state.score += 2 * curr.boost; // Take into account boost for better score estimation

        if (!prev) {
            return nextToken;
        }

        if (isPhrase(phrase, state.phrase, distance(prev.position, curr.position))) {
            state.score += 10 * curr.boost; // Take into account boost for better score estimation
            state.position[1] = curr.position[1];

            return nextToken;
        }

        return nextScore;
    }

    function end() {
        results = dedupe(results);
        return null;
    }
}

function get<F extends string>(field: F) {
    return function <T extends {[_prop in F]: unknown}>(object: T) {
        return object[field];
    };
}

function max(a: number, b: number) {
    return Math.max(a, b);
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

function dedupe(tokens: ScoreResult[]) {
    if (!tokens.length) {
        return tokens;
    }

    let prev = tokens[0];
    const result = [prev];
    for (let i = 1; i < tokens.length; i++) {
        const next = tokens[i] as ScoreResult;

        if (isIntersection(prev.position, next.position)) {
            result.pop();
            result.push((prev = withMaxScore(prev, next)));
        } else {
            result.push((prev = next));
        }
    }

    return result;
}

function isPhrase(phrase: string, tokens: string[], distance: number) {
    if (distance > MERGE_TOLERANCE) {
        return false;
    }

    tokens = tokens.slice();

    let index = 0;
    while (tokens.length && index > -1) {
        const token = tokens.shift() as string;

        index = phrase.indexOf(token, index);

        if (index > -1) {
            index += token.length;
        }
    }

    return index > -1;
}

function isIntersection(a: Position, b: Position) {
    return (a[1] >= b[0] && a[1] <= b[1]) || (a[1] >= b[0] && a[1] <= b[1]);
}

function withMaxScore(a: ScoreResult, b: ScoreResult) {
    return a.score >= b.score ? a : b;
}
