/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    snapshotFormat: {
        escapeString: true,
        printBasicPrototype: true,
    },
    transform: {
        '^.+\\.tsx?$': ['esbuild-jest', {tsconfig: './tsconfig.json'}],
    },
};
