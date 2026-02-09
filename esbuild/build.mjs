import {build} from '@diplodoc/lint/esbuild';
import {TsconfigPathsPlugin} from '@esbuild-plugins/tsconfig-paths';

import {indexer, worker} from './langs.mjs';

const common = {
    tsconfig: './tsconfig.json',
    bundle: true,
};

await indexer('src/indexer/langs');

build({
    ...common,
    target: 'node18',
    packages: 'external',
    platform: 'node',
    outdir: 'lib/indexer',
    entryPoints: ['src/indexer/index.ts'],
    plugins: [
        // eslint-disable-next-line new-cap
        TsconfigPathsPlugin({tsconfig: './tsconfig.json'}),
    ],
});

build({
    ...common,
    target: 'ES6',
    platform: 'browser',
    outdir: 'lib/worker',
    entryPoints: ['src/worker/index.ts'],
});

build({
    ...common,
    target: 'ES6',
    format: 'cjs',
    platform: 'browser',
    outdir: 'lib/worker/langs',
    entryPoints: await worker('src/worker/langs'),
});
