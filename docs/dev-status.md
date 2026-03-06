# Development Status

Last updated: 2026-03-06

## Completed (Sprint 1 Foundation)

### Infrastructure
- [x] Next.js 16 app (App Router, TypeScript, Tailwind CSS, shadcn/ui)
- [x] Supabase local stack running (`supabase start`)
- [x] Full schema migration: `organizations`, `org_members`, `integrations`, `context_items` (pgvector), `sessions`, `session_context_links`, `inbox_items`
- [x] Row Level Security on all tables via `get_user_org_ids()` helper
- [x] Auto org creation trigger on user signup
- [x] TypeScript types generated from schema (`src/lib/database.types.ts`)
- [x] GitHub Actions CI (typecheck → lint → test on every PR)
- [x] Vitest with jsdom — 4 tests passing

### Auth
- [x] Supabase SSR client (`src/lib/supabase/server.ts`, `client.ts`)
- [x] Middleware: session refresh + route protection
- [x] Login page (`/login`)
- [x] Signup page (`/signup`) — creates org via DB trigger
- [x] Auth callback route (`/auth/callback`)

### Integrations (Nango)
- [x] `@nangohq/node` + `@nangohq/frontend` installed
- [x] Nango server client (`src/lib/nango/client.ts`)
- [x] Single Nango webhook handler (`POST /api/webhooks/nango`) — receives sync events for ALL integrations (Granola, Linear, etc.), fetches records from Nango, upserts to `context_items`, triggers extract + embed

### Context Library (Sprint 1 core feature)
- [x] File parsing (`src/lib/ingest/parse.ts`): PDF (pdf-parse v1), DOCX (mammoth), TXT/MD
- [x] AI extraction (`src/lib/ai/extract.ts`): `generateObject` → title, summaries, entities
- [x] Embeddings (`src/lib/ai/embed.ts`): `embed` → 1536-dim vector for pgvector
- [x] Ingest API route (`POST /api/ingest/upload`): upload → parse → insert → extract → embed
- [x] Dashboard layout with sidebar nav (`src/components/sidebar-nav.tsx`)
- [x] Context library page (`/context`): file list + upload drag-and-drop

---

## Environment Variables Needed

Add to `.env.local` (never committed):

```bash
# Already filled in
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AI_GATEWAY_API_KEY=...
NANGO_SECRET_KEY=...
STRIPE_SECRET_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...

# Still needed for AI pipeline to work
ANTHROPIC_API_KEY=       # for generateObject (extraction)
OPENAI_API_KEY=          # for embed (text-embedding-3-small)

# Still pending
NEXT_PUBLIC_NANGO_PUBLIC_KEY=   # find in Nango dashboard → Settings → API Keys
NANGO_WEBHOOK_SECRET=            # set in Nango dashboard → Webhooks
STRIPE_WEBHOOK_SECRET=           # run: stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Next Up (Sprint 1 remaining)

### 1. Nango connect flow (Issue #5)
- Get `NEXT_PUBLIC_NANGO_PUBLIC_KEY` from Nango dashboard (Settings → API Keys)
- Build Integrations page (`/integrations`) with connect buttons per integration
- `POST /api/integrations/connect` — saves connection to `integrations` table after OAuth
- `GET /api/integrations` — list org integrations
- Set up Nango webhook URL in dashboard → `https://<your-domain>/api/webhooks/nango`

### 3. Chat interface (Sprint 2 – Issue #8)
- Install `@ai-sdk/anthropic` streaming
- Build `POST /api/chat` route using `streamText`
- RAG retrieval: hybrid search (vector cosine + full-text BM25 with RRF)
- Build `/chat` page with streaming UI (AI SDK `useChat` hook)

### 4. Inbox (Sprint 2 – Issue #9)
- Build `GET /api/inbox` — return user's inbox items
- Build `PATCH /api/inbox/[id]` — mark read/acted/dismissed
- Build `/inbox` page

### 5. Sessions (Sprint 3 – Issue #14)
- Sessions = named workspaces linking context items + chat history
- Build CRUD for sessions

---

## Key File Locations

| What | Where |
|------|--------|
| DB schema | `supabase/migrations/20260305231614_initial_schema.sql` |
| Org trigger | `supabase/migrations/20260306003151_org_creation_trigger.sql` |
| Supabase server client | `src/lib/supabase/server.ts` |
| Supabase browser client | `src/lib/supabase/client.ts` |
| Auth middleware | `src/middleware.ts` |
| File parser | `src/lib/ingest/parse.ts` |
| AI extraction | `src/lib/ai/extract.ts` |
| AI embedding | `src/lib/ai/embed.ts` |
| AI config (models) | `src/lib/ai/config.ts` |
| Upload API | `src/app/api/ingest/upload/route.ts` |
| Dashboard layout | `src/app/(dashboard)/layout.tsx` |
| Sidebar nav | `src/components/sidebar-nav.tsx` |
| Context library | `src/app/(dashboard)/context/page.tsx` |
| Upload widget | `src/components/context-uploader.tsx` |
| Sprint issues | `docs/linear-sprint-issues.md` |

## Commands

```bash
# Dev
pnpm dev

# Local Supabase
supabase start
supabase stop

# DB
pnpm db:reset          # reset + apply all migrations
pnpm db:types          # regenerate TypeScript types

# Tests
pnpm test              # vitest run
pnpm typecheck         # tsc --noEmit

# AI pipeline testing (needs ANTHROPIC_API_KEY + OPENAI_API_KEY in .env.local)
# Upload a file at http://localhost:3000/context after signing up
```
