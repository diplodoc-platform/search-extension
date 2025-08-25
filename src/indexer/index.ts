import lunr, {Builder} from 'lunr';

import {INDEX_FIELDS} from '../constants';

import {html2text} from './html';
import {langs} from './langs';

export type {WorkerConfig} from '../types';

export {html2text, langs};

export enum ReleaseFormat {
    JSONP = 'jsonp',
    RAW = 'raw',
}

type DocumentInfo = {
    title: string;
    content: string;
    keywords: string[];
};

type EntryInfo = {
    title?: string;
    html?: string;
    leading?: boolean;
    meta?: {
        noIndex?: boolean;
        noindex?: boolean;
        keywords?: string[];
    };
};

export class Indexer {
    private indices: Record<string, Builder> = {};

    private docs: Record<string, Record<string, DocumentInfo>> = {};

    /**
     * Stores list of current non empty language indexes.
     */
    get langs() {
        return Object.keys(this.indices);
    }

    /**
     * Adds new entry to search index
     *
     * @param lang - index language
     * @param url - document url, used as index uniq id
     * @param data - document json data
     *
     * @returns {void}
     */
    add(lang: string, url: string, data: Pick<EntryInfo, 'title' | 'html' | 'meta' | 'leading'>) {
        if (!this.indices[lang]) {
            this.init(lang);
        }

        const {leading, title = '', meta = {}} = data;

        // @ts-ignore
        if (leading || meta.noindex || meta.noIndex) {
            return;
        }

        const content = html2text(data.html || '');
        const keywords = meta.keywords || [];

        this.docs[lang][url] = {title, content, keywords};
        this.indices[lang].add({
            ...this.docs[lang][url],
            url,
        });
    }

    /**
     * Dumps index and registry for target language.
     *
     * @param lang - index language
     * @param format - output format
     *
     * @returns {{index: Index, registry: Registry}}
     */
    release(lang: string, format = ReleaseFormat.JSONP) {
        const index = this.indices[lang].build();
        const registry = this.docs[lang];

        if (format === ReleaseFormat.JSONP) {
            return {
                index: 'self.index=' + JSON.stringify(index),
                registry: 'self.registry=' + JSON.stringify(registry),
            };
        }

        return {index, registry};
    }

    private init(lang: string) {
        const index = new Builder();

        if (langs[lang]) {
            langs[lang](lunr);
            // @ts-ignore
            index.use(lunr.multiLanguage('en', lang));
        }

        index.ref('url');

        for (const [field, boost] of Object.entries(INDEX_FIELDS)) {
            index.field(field, {boost});
        }

        index.metadataWhitelist = ['position'];

        this.indices[lang] = index;
        this.docs[lang] = {};
    }
}
