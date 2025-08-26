import type {ISearchWorkerConfig} from '@diplodoc/client';

export enum Confidence {
    Phrased = 'phrased',
    Sparsed = 'sparsed',
}

export interface WorkerConfig extends ISearchWorkerConfig {
    tolerance: number;
    confidence: `${Confidence}` | Confidence;
    resources: {
        index: string;
        registry: string;
        language?: string;
    };
    skipHtmlExtension?: boolean;
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
