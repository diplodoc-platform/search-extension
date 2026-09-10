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

export function countResultsByTag(
    results: SearchResult[],
    registry: Registry,
): Record<string, number> {
    const counts = new Map<string, number>();

    for (const {ref} of results) {
        const tags = new Set(registry[ref]?.tags || []);

        for (const tag of tags) {
            if (!tag.startsWith('_')) {
                counts.set(tag, (counts.get(tag) || 0) + 1);
            }
        }
    }

    return Object.fromEntries(counts);
}
