import type {Registry} from '../types';
import type {SearchResult} from './search';

export function createRegistryResults(registry: Registry): SearchResult[] {
    return Object.keys(registry).map(
        (ref) =>
            ({
                ref,
                score: 0,
                matchData: {metadata: {}},
                scores: {},
            }) as SearchResult,
    );
}

export function filterResultsByTags(
    results: SearchResult[],
    registry: Registry,
    tags: string[],
): SearchResult[] {
    if (!tags.length) {
        return results;
    }

    const selectedTags = new Set(tags);

    return results.filter(({ref}) => registry[ref]?.tags?.some((tag) => selectedTags.has(tag)));
}
