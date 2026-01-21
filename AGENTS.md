## Common rules and standards

This package is a submodule in the Diplodoc metapackage. When working in metapackage mode, also follow:

- `../../.agents/style-and-testing.md` — code style, import organization, testing, English-only docs/comments/commit messages
- `../../.agents/monorepo.md` — workspace vs standalone dependency management (`--no-workspaces`)
- `../../.agents/dev-infrastructure.md` — infrastructure update recipes and CI conventions

## Project description

`@diplodoc/search-extension` provides offline search for Diplodoc based on Lunr.

Key parts:

- **Indexer** (`src/indexer/`) — extracts searchable content, builds index + registry
- **Worker** (`src/worker/`) — runs in client, searches in prepared index

## Development commands

```bash
npm run typecheck
npm test
npm run lint
npm run build
```
