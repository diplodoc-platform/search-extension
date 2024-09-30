import type {Index} from 'lunr';
import type {Score} from './score';
import type {WorkerConfig} from '../types';

// @ts-ignore
import {Query, QueryParser} from 'lunr';

import {INDEX_FIELDS} from '../constants';

import {phrased, sparsed} from './score';

const isStrategy = (candidate: unknown): candidate is Index.QueryBuilder =>
    typeof candidate === 'function';

const withIndex = (index: Index) => (builder: Index.QueryBuilder) =>
    function withIndex() {
        return index.query(builder);
    };

type Strategy = () => Index.Result[];

interface FixedIndex extends Index {
    fields: string[];
}

interface FixedClause extends Query.Clause {
    presence: Query.presence;
}

const makeStrategies = (tolerance: number, index: Index, clauses: FixedClause[], sealed: boolean) =>
    [
        tolerance >= 0 &&
            function precise(query: Query) {
                query.clauses = copy(clauses);
            },
        tolerance >= 0 &&
            !sealed &&
            function preciseUnsealed(query: Query) {
                query.clauses = copy(clauses);

                for (let i = query.clauses.length - 1; i >= 0; i--) {
                    const clause = query.clauses[i] as FixedClause;
                    if (clause.presence !== Query.presence.PROHIBITED) {
                        query.clauses[i] = wildcard(clause, Query.wildcard.TRAILING);
                        break;
                    }
                }
            },
        tolerance >= 1 &&
            function trailingWildcard(query: Query) {
                query.clauses = copy(clauses).map((clause) => {
                    if (clause.presence !== Query.presence.PROHIBITED) {
                        return wildcard(clause, Query.wildcard.TRAILING);
                    }
                    return clause;
                });
            },
        tolerance >= 2 &&
            function bothWildcard(query: Query) {
                query.clauses = copy(clauses).map((clause) => {
                    if (clause.presence !== Query.presence.PROHIBITED) {
                        // eslint-disable-next-line no-bitwise
                        return wildcard(clause, Query.wildcard.LEADING | Query.wildcard.TRAILING);
                    }
                    return clause;
                });
            },
    ]
        .filter(isStrategy)
        .map(withIndex(index));

export type SearchResult = Index.Result & {scores: Record<string, Score>};

export function search(
    {tolerance, confidence}: Pick<WorkerConfig, 'confidence' | 'tolerance'>,
    index: Index,
    query: string,
    count: number,
    sealed = true,
) {
    const parser = new QueryParser(query, new Query((index as FixedIndex).fields));
    const clauses = parser.parse().clauses as FixedClause[];
    const terms = clauses.map((clause) => clause.term);
    const strategies = makeStrategies(tolerance, index, clauses, sealed);
    const refs = new Set<string>();

    const score = confidence === 'sparsed' ? sparsed : phrased;
    const results: SearchResult[] = [];
    while (refs.size < count && strategies.length) {
        const strategy = strategies.shift() as Strategy;
        const match = strategy();

        for (const entry of match) {
            if (!refs.has(entry.ref)) {
                refs.add(entry.ref);

                results.push({
                    ...entry,
                    scores: score(entry, terms),
                });
            }
        }
    }

    return results.sort(byMaxScore).slice(0, count);
}

function wildcard(clause: FixedClause, mode: Query.wildcard) {
    const result = {...clause};

    const requiredLength =
        [
            // eslint-disable-next-line no-bitwise
            mode & Query.wildcard.TRAILING ? 2 : 0,
            // eslint-disable-next-line no-bitwise
            mode & Query.wildcard.LEADING ? 2 : 0,
        ].reduce((a, b) => a + b, 0) + 1;

    if (result.term.length < requiredLength) {
        return result;
    }

    // eslint-disable-next-line no-bitwise
    if (mode & Query.wildcard.TRAILING) {
        result.term = result.term + '*';
    }

    // eslint-disable-next-line no-bitwise
    if (mode & Query.wildcard.LEADING) {
        result.term = '*' + result.term;
    }

    result.wildcard = mode;
    result.usePipeline = false;

    return result;
}

function byMaxScore(a: SearchResult, b: SearchResult) {
    const aScore = getMaxScore(a);
    const bScore = getMaxScore(b);

    return bScore - aScore;
}

function getMaxScore(result: SearchResult) {
    let score = 0;
    for (const [field] of Object.entries(INDEX_FIELDS)) {
        const scores = result.scores[field];
        if (scores) {
            score = Math.max(scores.score, score);
        }
    }

    return score;
}

function copy(clauses: FixedClause[]) {
    return clauses.slice().map((clause) => ({...clause}));
}
