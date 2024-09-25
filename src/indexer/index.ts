import type {DocPageData} from '@diplodoc/components';

import lunr, {Builder} from 'lunr';

import {INDEX_FIELDS} from '../constants';

import {langs} from './langs';
import {html2text} from './html';

type DocumentInfo = {
    title: string;
    content: string;
    keywords: string[];
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
    add(lang: string, url: string, data: DocPageData) {
        if (!this.indices[lang]) {
            this.init(lang);
        }

        const {leading, toc, meta = {}} = data;

        // @ts-ignore
        if (leading || meta.noindex || meta.noIndex) {
            return;
        }

        const content = html2text(data.html);
        const title = meta.title || data.title || toc.title || '';
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
     *
     * @returns {{index: Index, registry: Registry}}
     */
    release(lang: string) {
        const index = JSON.stringify(this.indices[lang].build());
        const registry = JSON.stringify(this.docs[lang]);

        return {index, registry};
    }

    private init(lang: string) {
        const index = new Builder();

        if (langs[lang]) {
            index.use(langs[lang](lunr));
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
