import type {Index} from 'lunr';
import type {Score} from './score';
import type {WorkerConfig} from '../types';

// @ts-ignore
import {Query, QueryParser} from 'lunr';

import {score} from './score';

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
        tolerance > -1 &&
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
        tolerance > 0 &&
            function trailingWildcard(query: Query) {
                query.clauses = clauses.map((clause) => {
                    if (clause.presence !== Query.presence.PROHIBITED) {
                        wildcard(clause, Query.wildcard.TRAILING);
                    }
                    return clause;
                });
            },
        tolerance > 1 &&
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
    {tolerance}: WorkerConfig,
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

    const results: SearchResult[] = [];
    while (refs.size < count && strategies.length) {
        const strategy = strategies.shift() as Strategy;
        const match = strategy();

        for (const entry of match) {
            if (!refs.has(entry.ref)) {
                refs.add(entry.ref);
                results.push({
                    ...entry,
                    scores: score(terms, entry),
                });
            }
        }
    }

    return results.slice(0, count);
}

function wildcard(clause: FixedClause, mode: Query.wildcard) {
    // eslint-disable-next-line no-bitwise
    if (mode & Query.wildcard.TRAILING) {
        clause.term = clause.term + '*';
    }

    // eslint-disable-next-line no-bitwise
    if (mode & Query.wildcard.LEADING) {
        clause.term = '*' + clause.term;
    }

    clause.wildcard = mode;
    clause.usePipeline = false;
}
