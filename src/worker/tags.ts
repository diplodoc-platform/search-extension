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
    const selectedTags = new Set(tags.filter((tag) => !tag.startsWith('_')));

    if (!selectedTags.size) {
        return results;
    }

    return results.filter(({ref}) => registry[ref]?.tags?.some((tag) => selectedTags.has(tag)));
}
