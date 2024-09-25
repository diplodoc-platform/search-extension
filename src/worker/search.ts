import type {Index} from 'lunr';
import type {Score} from './score';
import type {WorkerConfig} from '../types';

// @ts-ignore
import {Query, QueryParser} from 'lunr';

import {INDEX_FIELDS} from '../constants';

import {phrased, sparsed} from './score';

const withIndex = (index: Index) => (builder: Index.QueryBuilder | false) =>
    function withIndex() {
        if (!builder) {
            return false;
        }

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
                query.clauses = clauses.slice();

                for (let i = query.clauses.length - 1; i >= 0; i--) {
                    const clause = query.clauses[i] as FixedClause;
                    if (clause.presence !== Query.presence.PROHIBITED && !sealed) {
                        wildcard(clause, Query.wildcard.TRAILING);
                        break;
                    }
                }
            },
        tolerance >= 1 &&
            function trailingWildcard(query: Query) {
                query.clauses = clauses.map((clause) => {
                    if (clause.presence !== Query.presence.PROHIBITED) {
                        wildcard(clause, Query.wildcard.TRAILING);
                    }
                    return clause;
                });
            },
        tolerance >= 2 &&
            function bothWildcard(query: Query) {
                query.clauses = clauses.map((clause) => {
                    if (clause.presence !== Query.presence.PROHIBITED) {
                        // eslint-disable-next-line no-bitwise
                        wildcard(clause, Query.wildcard.LEADING | Query.wildcard.TRAILING);
                    }
                    return clause;
                });
            },
    ]
        .filter(Boolean)
        .map(withIndex(index));

export type SearchResult = Index.Result & {scores: Record<string, Score>};

export function search(
    {tolerance, confidence}: WorkerConfig,
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
    const requiredLength =
        [
            // eslint-disable-next-line no-bitwise
            mode & Query.wildcard.TRAILING ? 2 : 0,
            // eslint-disable-next-line no-bitwise
            mode & Query.wildcard.LEADING ? 2 : 0,
        ].reduce((a, b) => a + b, 0) + 1;

    if (clause.term.length < requiredLength) {
        return;
    }

    // eslint-disable-next-line no-bitwise
    if (mode & Query.wildcard.TRAILING) {
        clause.term = clause.term.slice(0, -1) + '*';
    }

    // eslint-disable-next-line no-bitwise
    if (mode & Query.wildcard.LEADING) {
        clause.term = '*' + clause.term.slice(1);
    }

    clause.wildcard = mode;
    clause.usePipeline = false;
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
