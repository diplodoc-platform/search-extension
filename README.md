# Diplodoc search extension

[![NPM version](https://img.shields.io/npm/v/@diplodoc/search-extension.svg?style=flat)](https://www.npmjs.org/package/@diplodoc/search-extension)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_search-extension&metric=alert_status)](https://sonarcloud.io/summary/overall?id=diplodoc-platform_search-extension)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_search-extension&metric=coverage)](https://sonarcloud.io/summary/overall?id=diplodoc-platform_search-extension)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_search-extension&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=diplodoc-platform_search-extension)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_search-extension&metric=reliability_rating)](https://sonarcloud.io/summary/overall?id=diplodoc-platform_search-extension)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=diplodoc-platform_search-extension&metric=security_rating)](https://sonarcloud.io/summary/overall?id=diplodoc-platform_search-extension)
[![Tests](https://github.com/diplodoc-platform/search-extension/actions/workflows/tests.yml/badge.svg?branch=master)](https://github.com/diplodoc-platform/search-extension/actions/workflows/tests.yml)

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
