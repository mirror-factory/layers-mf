# Layers Platform

> The operating system for AI-native knowledge teams.

Layers connects fragmented tools — Granola, Linear, GitHub, Google Drive, Slack, Discord — into a unified context layer with intelligent agents that understand what's happening across your entire business.

---

## Status

| Field | Value |
|---|---|
| **Phase** | P1 Prototype |
| **Snapshot Date** | 2026-03-30 |
| **Branch** | `backup/2026-03-30-p1-prototype` |
| **Last Commit** | `8228572` — chore: add platform link to sprint presentation + update date |
| **Database Migrations** | 13 |
| **Test Coverage** | Unit tests via Vitest |
| **Deployment** | Vercel (cron jobs, streaming, 60s timeout) |

### What's Working (P1)

- [x] Supabase Auth (signup, login, org auto-creation, invitations)
- [x] Multi-model chat with ToolLoopAgent (Claude, GPT-4o, Gemini)
- [x] Context Library — browse, filter, search ingested documents
- [x] Hybrid search (pgvector + pg_trgm + Reciprocal Rank Fusion)
- [x] Document upload + AI extraction pipeline (title, summaries, entities)
- [x] Embedding generation (OpenAI text-embedding-3-small, 1536 dims)
- [x] Integration hub — GitHub, Google Drive, Slack, Granola, Linear via Nango
- [x] Session workspaces with scoped context and agents
- [x] Inbox with AI-generated action items, decisions, and daily digest (cron)
- [x] Team management (org members, invitations, roles)
- [x] Agent analytics (tool calls, tokens, duration, model breakdown)
- [x] Audit logging
- [x] Rate limiting (10 req/min per user)
- [x] Row-Level Security on all tables

### What's Next (P2+)

- [ ] Background job queue (replace inline processing with Bull/Inngest)
- [ ] Nango replacement (evaluating n8n, Activepieces, Composio)
- [ ] Real-time collaboration (websockets)
- [ ] Agent specialization and Ditto personalization
- [ ] Expanded integration coverage
- [ ] Mobile app

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v3.4, shadcn/ui |
| **AI** | Vercel AI SDK v6, AI Gateway (single key → Claude, GPT-4o, Gemini) |
| **Database** | PostgreSQL via Supabase, pgvector, pg_trgm |
| **Auth** | Supabase Auth (JWT, SSR middleware) |
| **Integrations** | Nango (OAuth + proxy for 5 providers) |
| **Payments** | Stripe |
| **Testing** | Vitest, @vitest/coverage-v8 |
| **Package Manager** | pnpm |
| **Deployment** | Vercel |

---

## Architecture

```
Sources (Granola, Linear, GitHub, Drive, Slack, Upload)
  → Ingest (parse PDF/DOCX/text, Nango proxy sync)
    → AI Extraction (Claude Haiku → title, summaries, entities)
      → Embed (text-embedding-3-small, 1536 dims)
        → Store (PostgreSQL + pgvector + pg_trgm)
          → Hybrid Search (vector + full-text, RRF k=60)
            → ToolLoopAgent (up to 6 steps, search + retrieve tools)
              → Inbox (action items, decisions, daily digest cron)
```

### AI Capabilities

| Feature | Model | SDK Function |
|---|---|---|
| Chat agent | User-selected (7 models) | `ToolLoopAgent` + `createAgentUIStreamResponse()` |
| Document extraction | Claude Haiku 4.5 | `generateObject()` with Zod schema |
| Embeddings | text-embedding-3-small | `embed()` via AI Gateway |
| Inbox generation | Claude Haiku 4.5 | `generateText()` + `Output.array()` |

### Database Tables

`organizations` · `org_members` · `integrations` · `context_items` · `sessions` · `session_context_links` · `session_members` · `inbox_items` · `chat_messages` · `conversations` · `agent_runs` · `org_invitations` · `audit_log`

### Data Connectors

| Provider | Data | Limits |
|---|---|---|
| GitHub | Repos → Issues | 4 repos, 8 issues/repo |
| Google Drive | Docs, Sheets, Slides → text export | 100 files |
| Slack | Public channels → messages | 3 channels, 50 msgs each |
| Granola | Meeting transcripts + attendees | 30 transcripts |
| Linear | Issues with metadata | 30 issues |
| Upload | PDF, DOCX, TXT, MD | 10MB max |

---

## Getting Started

```bash
# Prerequisites: Node.js, pnpm, Docker (for local Supabase)

# 1. Install dependencies
pnpm install

# 2. Start local Supabase
supabase start

# 3. Copy environment variables
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#          SUPABASE_SERVICE_ROLE_KEY, AI_GATEWAY_API_KEY, NANGO_SECRET_KEY

# 4. Apply database migrations
pnpm db:reset

# 5. Start dev server
pnpm dev
# → http://localhost:3004
```

---

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server (port 3004) |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript validation |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:coverage` | Tests with coverage report |
| `pnpm eval` | AI evaluation harnesses (retrieval, agent, extraction, health) |
| `pnpm db:reset` | Reset local Supabase to latest migrations |
| `pnpm db:types` | Regenerate TypeScript types from schema |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, signup, callback
│   ├── (dashboard)/         # Protected routes
│   │   ├── chat/            # Chat interface
│   │   ├── context/         # Context library
│   │   ├── sessions/        # Session workspaces
│   │   ├── inbox/           # User inbox
│   │   ├── integrations/    # Integration management
│   │   ├── analytics/       # Usage KPIs
│   │   └── settings/        # Profile, team, audit
│   └── api/                 # API endpoints (15+)
├── components/              # React components + shadcn/ui
├── lib/
│   ├── ai/                  # Tools, config, extract, embed, evals
│   ├── db/                  # Hybrid search (RRF)
│   ├── supabase/            # Client setup (server/client/admin)
│   ├── nango/               # Integration client
│   └── kpi/                 # Analytics computation
└── middleware.ts            # Auth route protection
supabase/
└── migrations/              # 13 SQL migrations
```

---

## License

Proprietary — Mirror Factory, Inc.
