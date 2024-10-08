# Diplodoc search extension

[![NPM version](https://img.shields.io/npm/v/@diplodoc/search-extension.svg?style=flat)](https://www.npmjs.org/package/@diplodoc/search-extension)

This is an extension of the Diplodoc platform, which adds offline search functionality.
It uses [lunr](https://lunrjs.com/) search

The extension contains some parts:

- [Indexer](#indexer)
- [Worker](#worker)

## Indexer {#indexer}

Extracts text information from documents.
Prepares search index and search documents registry.

Instance methods:

**add** - Adds new entry to search index

**release** - Dumps index and registry for target language.

## Worker {#worker}

Implements client search worker interface. Uses prepared in indexer lunr index to resolve search requests.

Extends search score algorithm:

- Adds `tolerance` behavior.
  `tolerance=0` - only search for strict equal words
  `tolerance=1` - also search for words with unspecified tail. `word*`
  `tolerance=2` - also search for words with unspecified tail and head. `*word*`

- Adds `confidence` behavior.
  `phrased` - default. Additionally scores results by found phrase length
  `sparsed` - Uses default lunr scoring algorithm.
