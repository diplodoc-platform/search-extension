/// <reference no-default-lib="true"/>
/// <reference lib="ES2019" />
/// <reference lib="webworker" />

/* eslint-disable new-cap */
import type {Registry, WorkerConfig} from '../types';
import type {ISearchWorkerApi} from '@diplodoc/client';

import lunr, {Builder, Index} from 'lunr';

import {search} from './search';
import {format, long, short} from './format';

// Default type of `self` is `WorkerGlobalScope & typeof globalThis`
// https://github.com/microsoft/TypeScript/issues/14877
declare const self: ServiceWorkerGlobalScope & {
    config?: WorkerConfig;
    api?: ISearchWorkerApi;
    language?: (lunr: unknown) => Builder.Plugin;
    index: object;
    registry: Registry;
};

const NOT_INITIALIZED = {
    message: 'Worker is not initialized with required config!',
    code: 'NOT_INITIALIZED',
};

export function AssertConfig(config: unknown): asserts config is WorkerConfig {
    if (!config) {
        throw NOT_INITIALIZED;
    }
}

let config: WorkerConfig | null = null;
let index: Index | null = null;
let registry: Registry | null = null;

self.api = {
    async init() {
        config = {
            tolerance: 2,
            confidence: 'phrased',
            ...self.config,
        } as WorkerConfig;
    },

    async suggest(query, count) {
        AssertConfig(config);

        const [index, registry] = await load();
        const results = search(config, index, query, count, false);

        return format(config, results, registry, short);
    },

    async search(query, count) {
        AssertConfig(config);

        const [index, registry] = await load();
        const result = search(config, index, query, count, true);

        return format(config, result, registry, long);
    },
} as ISearchWorkerApi;

async function load(): Promise<[Index, Registry]> {
    AssertConfig(config);

    if (index && registry) {
        return [index, registry];
    }

    const promise: Promise<[Index, Registry]> = (async () => {
        const scripts = [
            `${config.base}/${config.resources.index}`,
            `${config.base}/${config.resources.registry}`,
            config.resources.language && `${config.base}/${config.resources.language}`,
        ].filter(Boolean) as string[];

        // Load resources using importScripts instead of fetch
        // because fetch will produce CORS errors on file:// protocol
        importScripts(...scripts);

        const {index, registry, language} = self;

        if (language) {
            language(lunr);
        }

        return [Index.load(index), registry];
    })();

    promise.catch((error) => {
        // eslint-disable-next-line no-console
        console.error(error);
    });

    [index, registry] = await promise;

    return [index, registry];
}
