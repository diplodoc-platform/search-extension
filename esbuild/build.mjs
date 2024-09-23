import esbuild from 'esbuild';
import {TsconfigPathsPlugin} from '@esbuild-plugins/tsconfig-paths';
import {nodeExternalsPlugin} from 'esbuild-node-externals';

const common = {
    tsconfig: './tsconfig.json',
    bundle: true,
};

esbuild.build({
    ...common,
    target: 'node18',
    packages: 'external',
    platform: 'node',
    outdir: 'lib/indexer',
    entryPoints: ['src/indexer/index.ts'],
    plugins: [
        // eslint-disable-next-line new-cap
        TsconfigPathsPlugin({tsconfig: './tsconfig.json'}),
        nodeExternalsPlugin(),
    ],
});

esbuild.build({
    ...common,
    target: 'ES6',
    platform: 'browser',
    outdir: 'lib/worker',
    entryPoints: ['src/worker/index.ts'],
});
