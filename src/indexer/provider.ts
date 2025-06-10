import type {BuildRun, EntryInfo, SearchProvider} from '@diplodoc/cli';
import type {WorkerConfig} from '../worker';

import {extname, join} from 'node:path';
import {createHash} from 'node:crypto';
import lunr, {Builder} from 'lunr';

import {INDEX_FIELDS} from '../constants';

import {html2text} from './html';
import {langs} from './langs';

export type ProviderConfig = Pick<WorkerConfig, 'tolerance' | 'confidence'> & {
    enabled: boolean;
};

export enum ReleaseFormat {
    JSONP = 'jsonp',
    RAW = 'raw',
}

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

export class LocalSearchProvider implements SearchProvider {
    private run: BuildRun;

    private _config: ProviderConfig;

    private indexer: Indexer;

    private outputDir: string;

    private apiLink: string;

    private nocache: string;

    constructor(run: BuildRun, config: ProviderConfig) {
        this.run = run;
        this._config = config;
        this.indexer = new Indexer();

        this.outputDir = '_search';
        this.apiLink = join(this.outputDir, 'api.js');
        this.nocache = String(Date.now());
    }

    async add(path: string, lang: string, info: EntryInfo) {
        if (!info.html) {
            return;
        }

        const url = path.replace(extname(path), '') + '.html';

        this.indexer.add(lang, url, info);
    }

    async release() {
        await this.run.copy(
            join(this.run.assetsPath, 'search-extension', 'api.js'),
            join(this.run.output, this.apiLink),
        );

        for (const lang of this.indexer.langs) {
            const {index, registry} = await this.indexer.release(lang);

            const indexHash = hash(index as string);
            const registryHash = hash(registry as string);
            const indexLink = this.indexLink(lang, indexHash);
            const registryLink = this.registryLink(lang, registryHash);
            const languageLink = this.languageLink(lang);
            const resourcesLink = this.resourcesLink(lang);
            const pageLink = this.pageLink(lang);

            await this.run.write(join(this.run.output, indexLink), index as string);
            await this.run.write(join(this.run.output, registryLink), registry as string);
            await this.run.write(
                join(this.run.output, resourcesLink),
                this.resources(indexLink, registryLink, languageLink),
            );
            await this.run.write(join(this.run.output, pageLink), await this.run.search.page(lang));

            if (languageLink) {
                await this.run.copy(
                    join(this.run.assetsPath, 'search-extension', 'langs', lang + '.js'),
                    join(this.run.output, languageLink),
                );
            }
        }
    }

    config(lang: string) {
        return {
            ...this._config,
            api: this.apiLink,
            provider: 'local',
            link: this.pageLink(lang),
        };
    }

    resourcesLink(lang: string) {
        return join(this.outputDir, lang, `${this.nocache}-resources.js`);
    }

    private resources(indexLink: string, registryLink: string, languageLink: string) {
        const resources = {
            index: indexLink,
            registry: registryLink,
            language: languageLink || undefined,
        };

        return `window.__DATA__.search.resources = ${JSON.stringify(resources)};`;
    }

    private indexLink(lang: string, hash: string) {
        return join(this.outputDir, lang, `${hash}-index.js`);
    }

    private registryLink(lang: string, hash: string) {
        return join(this.outputDir, lang, `${hash}-registry.js`);
    }

    private languageLink(lang: string) {
        if (!langs.includes(lang)) {
            return '';
        }

        return join(this.outputDir, lang, `language.js`);
    }

    private pageLink(lang: string) {
        return join(this.outputDir, lang, `index.html`);
    }
}

function hash(content: string) {
    const hash = createHash('sha256');

    hash.update(content);

    return hash.digest('hex').slice(0, 12);
}
