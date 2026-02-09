#!/usr/bin/env node

/**
 * Generates src/indexer/langs/*.ts so that src/indexer/index.ts can import ./langs.
 * Required before running tests or typecheck without a full build.
 */

import {indexer} from '../esbuild/langs.mjs';

await indexer('src/indexer/langs');
