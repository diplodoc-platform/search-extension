import type {ISearchWorkerConfig} from '@diplodoc/client';

enum Confidence {
    Phrased = 'phrased',
    Sparsed = 'sparsed',
}

export interface WorkerConfig extends ISearchWorkerConfig {
    tolerance: number;
    confidence: Confidence;
    resources: {
        index: string;
        registry: string;
        language?: string;
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
