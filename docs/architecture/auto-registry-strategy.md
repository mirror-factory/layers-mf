# Auto-Registry Strategy — Convention Over Configuration

> Status: Approved
> Date: 2026-04-06
> Why: Manual registries go stale. Folder structure should BE the registry.

---

## Principle

**If something exists in a specific folder, it is automatically registered.** No manual lists to maintain. No docs to update by hand. The code structure IS the source of truth, and documentation is generated from it.

## What We Auto-Generate

| Registry | Source of Truth | Generator Tool | Output |
|----------|----------------|---------------|--------|
| AI Tools | `src/lib/ai/tools/{name}/index.ts` | Custom prebuild script | `tools/_registry.ts` + `docs/generated/tools.md` |
| API Routes | `src/app/api/**/route.ts` | `next-openapi-gen` | `public/openapi.json` + `/api/docs` UI |
| DB Schema | Live Postgres schema + SQL comments | `tbls` | `docs/generated/schema/` (per-table markdown + ER diagram) |
| TypeScript Types | Live Postgres schema | `supabase gen types` | `src/lib/database.types.ts` (already exists) |
| UI Components | `src/components/ui/*.tsx` + `src/components/ai-elements/*.tsx` | Custom script scanning exports | `docs/generated/components.md` |
| Notification Events | `src/lib/notifications/events/{name}.ts` | Custom script | `docs/generated/events.md` |

## How It Stays in Sync

```
Developer adds a new tool:
  1. Creates src/lib/ai/tools/my-new-tool/index.ts
  2. Exports: { definition, metadata }
  3. Runs `pnpm prebuild` (or it runs automatically before dev/build)
  4. tools/_registry.ts is regenerated (barrel file)
  5. docs/generated/tools.md is regenerated
  6. createTools() reads from _registry.ts — tool is available
  7. /tools page shows it automatically (reads from /api/tools/registry)
```

```
Developer runs a migration:
  1. Applies migration via Supabase
  2. Runs `pnpm db:docs` (tbls doc)
  3. docs/generated/schema/ is regenerated with new table/columns
  4. Runs `pnpm db:types` (supabase gen types)
  5. src/lib/database.types.ts is regenerated
  6. CI: `tbls diff` fails if docs are stale
```

```
Developer adds an API route:
  1. Creates src/app/api/my-route/route.ts
  2. Adds @openapi JSDoc block with Zod schemas
  3. Runs `pnpm api:docs` (next-openapi-gen)
  4. public/openapi.json is regenerated
  5. /api/docs page updates automatically
```

## Tool Directory Convention

Each tool is a folder with a standard shape:

```
src/lib/ai/tools/
  search-context/
    index.ts          # Tool definition + metadata
    index.test.ts     # Unit tests (optional)
  write-code/
    index.ts
  web-search/
    index.ts
  _registry.ts        # AUTO-GENERATED — do not edit
  _types.ts           # Shared types for tool metadata
```

Each `index.ts` exports:

```typescript
import { tool } from "ai";
import { z } from "zod";
import type { ToolMetadata } from "../_types";

export const metadata: ToolMetadata = {
  name: "search_context",
  category: "knowledge",
  service: "supabase",
  access: "read",
  description: "Search the knowledge base using hybrid vector + BM25 search",
};

export const definition = tool({
  description: metadata.description,
  inputSchema: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Max results"),
  }),
  execute: async ({ query, limit }) => {
    // implementation
  },
});
```

The `_registry.ts` is auto-generated:

```typescript
// AUTO-GENERATED — do not edit manually
// Run `pnpm tools:generate` to regenerate
import { definition as searchContext, metadata as searchContextMeta } from "./search-context";
import { definition as writeCode, metadata as writeCodeMeta } from "./write-code";
// ... all tools

export const tools = { search_context: searchContext, write_code: writeCode, ... };
export const toolMetadata = [searchContextMeta, writeCodeMeta, ...];
```

## Docs Structure

```
docs/
  architecture/          # Human-written design docs (ADRs, proposals, guides)
    chat/
    artifacts/
    library/
    sharing/
    organization/
    integrations/
    scheduling/
    platform/
    roadmap.md
    README.md
    archive/

  generated/             # AUTO-GENERATED — do not edit
    tools.md             # From src/lib/ai/tools/*/index.ts
    api-reference.md     # From next-openapi-gen
    schema/              # From tbls
      context_items.md
      artifacts.md
      ...
    components.md        # From src/components/
    events.md            # From src/lib/notifications/events/
    README.md            # Index of generated docs with timestamps
```

## Package.json Scripts

```json
{
  "scripts": {
    "tools:generate": "node scripts/generate-tool-registry.mjs",
    "api:docs": "next-openapi-gen",
    "db:docs": "tbls doc",
    "db:types": "supabase gen types typescript --local > src/lib/database.types.ts",
    "docs:generate": "pnpm tools:generate && pnpm api:docs && pnpm db:docs",
    "prebuild": "pnpm tools:generate",
    "predev": "pnpm tools:generate"
  }
}
```

## CI Pipeline

On every push to main:
1. TypeScript check
2. Unit tests
3. `pnpm docs:generate` — regenerate all auto-docs
4. `tbls diff` — fail if DB docs are stale
5. Commit generated docs (if changed)

## Why This Approach

Research sources:
- **tbls** (3.5k+ GitHub stars) — CI-friendly DB documentation from live Postgres
- **next-openapi-gen** — Scans App Router routes + Zod schemas for OpenAPI spec
- **Convention-over-configuration** — Rails/Ember pattern: folder structure IS the registry
- **Kent C. Dodds' colocation principle** — Place code as close to where it's relevant as possible
- **Cal.com monorepo structure** — Domain-driven organization with shared packages

The key insight: **manual documentation always goes stale**. The only docs that stay accurate are the ones generated from the code itself. Human-written architecture docs (the "why") live separately from auto-generated reference docs (the "what").

## Migration Plan

1. Document the approach (this doc)
2. Split `src/lib/ai/tools.ts` into `src/lib/ai/tools/` directory
3. Write `scripts/generate-tool-registry.mjs`
4. Install + configure `tbls`
5. Install + configure `next-openapi-gen`
6. Add `docs/generated/` to .gitignore (or commit — team preference)
7. Add CI pipeline step
8. Restructure `docs/architecture/` into domain folders
