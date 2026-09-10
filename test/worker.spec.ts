import type {Index} from 'lunr';
import type {ISearchWorkerApi} from '@diplodoc/client';
import type {Registry, WorkerConfig} from '../src/types';

import {afterEach, describe, expect, it, vi} from 'vitest';

import {Indexer, ReleaseFormat} from '../src/indexer';

type WorkerScope = {
    config: WorkerConfig;
    index: object;
    registry: Registry;
    api?: ISearchWorkerApi;
};

describe('worker search tag counts', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it('returns counts before applying tag filters and pagination', async () => {
        const indexer = new Indexer();

        indexer.add('en', 'info.html', {
            title: 'Info',
            html: 'Search content',
            meta: {tags: ['info']},
        });
        indexer.add('en', 'guide.html', {
            title: 'Guide',
            html: 'Search content',
            meta: {tags: ['guide']},
        });

        const {index, registry} = indexer.release('en', ReleaseFormat.RAW);

        if (typeof index === 'string' || typeof registry === 'string') {
            throw new Error('Expected raw search resources');
        }

        const workerScope: WorkerScope = {
            config: {
                base: '/',
                mark: 'mark',
                tolerance: 2,
                confidence: 'phrased',
                resources: {index: 'index.js', registry: 'registry.js'},
            },
            index: (index as Index).toJSON(),
            registry: registry as Registry,
        };

        vi.stubGlobal('self', workerScope);
        vi.stubGlobal('importScripts', vi.fn());

        await import('../src/worker/index');
        await workerScope.api?.init?.();

        const result = await workerScope.api?.search('', 1, 1, ['info']);

        expect(result).toMatchObject({
            total: 1,
            tagCounts: {info: 1, guide: 1},
        });
        expect(result?.items).toHaveLength(1);
    });
});
