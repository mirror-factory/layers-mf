# Layers MF

## Changelog

### 2026-04-29 - Library Layer foundation

This branch turns the app toward the Library Layer described in the Mirror Factory "Where we're going" presentation from April 22, 2026. The product direction is: Layers is the company context box, Dewey is the resident librarian assistant, and the system centers on two verbs: find/ingest content, then act on that content.

This work is based on the Mirror Factory AI Starter Kit from `mirror-factory/vercel-ai-starter-kit` and its recent `main` commit `829795c` (`fix: harden dev-kit dashboard repair path`). The starter kit gates, docs sync, Expect coverage check, React Scan/Million hooks, and dev-kit doctor are now part of the app workflow.

## Current Focus

- Library domain over the existing context system: `context_items` become Library Items, `collections` become Stacks, and `inbox_items` remain the Library Inbox.
- Dewey as the product-facing assistant identity in chat, backed by a configurable Dewey profile.
- MCP ingestion modes: Live Lookup, Save Selected, and Sync Rule.
- Library assets, provenance, context packs, artifact save-back, and a first Layers-as-MCP-server route.
- Production gates for Supabase migration hygiene, typecheck, lint, unit tests, Expect coverage, UI checks, and starter-kit score.

## Useful Commands

```bash
pnpm dev
pnpm check:migrations
pnpm typecheck
pnpm lint
pnpm test
pnpm test:expect
pnpm sync
pnpm score
```

## Canonical Plan

The full architecture and phased roadmap live in [docs/plans/library-layer.md](docs/plans/library-layer.md).
