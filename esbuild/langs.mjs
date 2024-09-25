import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {dedent} from 'ts-dedent';

const LANGS = [
    'ar',
    'da',
    'de',
    'du',
    'el',
    'es',
    'fi',
    'fr',
    'he',
    'hu',
    'hy',
    'it',
    'ko',
    'nl',
    'no',
    'pt',
    'ro',
    'ru',
    'sv',
    'tr',
    'vi',

    // 'zh',
    'ja',
    'jp',
    'th',
    'hi',
    'ta',
    'sa',
    'kn',
    'te',
];

export async function indexer(outdir) {
    for (const lang of LANGS) {
        const exports = dedent`
            export function ${lang}(lunr: any) {
                ${attach(lang)}

                return (lunr as unknown as {[lang: string]: Builder.Plugin}).${lang} as Builder.Plugin;
            }
        `;

        const template = resolve(outdir, lang + '.ts');

        await writeFile(
            template,
            dedent`
            ${imports(lang)}
            ${exports}
        `,
            'utf8',
        );
    }

    const template = resolve(outdir, 'index.ts');

    await writeFile(
        template,
        dedent`
            import type {Builder} from 'lunr';

            ${LANGS.map((lang) => `import {${lang}} from './${lang}.js';`).join('\n')}

            type Langs = Record<string, {(lunr: any): Builder.Plugin}>;

            export const langs: Langs = {${LANGS.join(', ')}};
        `,
        'utf8',
    );
}

export async function worker(outdir) {
    const entries = [];

    for (const lang of LANGS) {
        const exports = dedent`
            /// <reference no-default-lib="true"/>
            /// <reference lib="ES2019" />
            /// <reference lib="webworker" />

            // Default type of \`self\` is \`WorkerGlobalScope & typeof globalThis\`
            // https://github.com/microsoft/TypeScript/issues/14877
            declare const self: ServiceWorkerGlobalScope & {
                language?: (lunr: any) => Builder.Plugin;
            };

            self.language = function(lunr: any) {
                ${attach(lang)}

                return (lunr as unknown as {[lang: string]: Builder.Plugin}).${lang} as Builder.Plugin;
            };
        `;

        const template = resolve(outdir, lang + '.ts');

        await writeFile(
            template,
            dedent`
                ${imports(lang)}
                ${exports}
            `,
            'utf8',
        );

        entries.push(template);
    }

    const template = resolve(outdir, 'index.ts');

    await writeFile(
        template,
        dedent`
            type Langs = string[];

            export const langs: Langs = [${LANGS.map((lang) => `'${lang}'`).join(', ')}];
        `,
        'utf8',
    );

    entries.push(template);

    return entries;
}

function imports(lang) {
    return dedent`
        import type {Builder} from 'lunr';

        // @ts-ignore
        import stemmer from 'lunr-languages/lunr.stemmer.support';
        // @ts-ignore
        import lang from 'lunr-languages/lunr.${lang}';
        ${
            ['ja', 'jp'].includes(lang)
                ? `
                        // @ts-ignore
                        import tinyseg from 'lunr-languages/tinyseg';
                      `
                : ''
        }
        ${
            ['th', 'hi', 'ta', 'sa', 'kn', 'te'].includes(lang)
                ? `
                        // @ts-ignore
                        import wordcut from 'lunr-languages/wordcut';
                      `
                : ''
        }
    `;
}

function attach(lang) {
    return dedent`
        stemmer(lunr);
        lang(lunr);
        ${['ja', 'jp'].includes(lang) ? `tinyseg(lunr);` : ''}
        ${['th', 'hi', 'ta', 'sa', 'kn', 'te'].includes(lang) ? `wordcut(lunr);` : ''}
    `;
}
