import {coverageConfigDefaults, defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: false,
        include: ['test/**/*.spec.ts', 'test/**/*.test.ts'],
        exclude: ['node_modules', 'lib', 'build', 'dist', 'coverage'],
        snapshotFormat: {
            escapeString: true,
            printBasicPrototype: true,
        },
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            exclude: [
                'test/**',
                '**/langs/**',
                '**/*.spec.ts',
                '**/*.test.ts',
                ...coverageConfigDefaults.exclude,
            ],
            reporter: ['text', 'json', 'html', 'lcov'],
        },
    },
});
