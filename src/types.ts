import type {ISearchWorkerConfig} from '@diplodoc/client';

export interface WorkerConfig extends ISearchWorkerConfig {
    tolerance: number;
    resources: {
        index: string;
        registry: string;
    };
}

export type Position = [number, number];

export type IndexDocument = {
    url: string;
    title: string;
    content: string;
    breadcrumbs?: string[];
    keywords?: string[];
};

export type Registry = Record<string, IndexDocument>;
