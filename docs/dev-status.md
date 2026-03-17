# Development Status

Last updated: 2026-03-16

## Phase Summary

| Phase | Sprints | Status | Issues |
|-------|---------|--------|--------|
| **P1 — Prototype** | 1-3 (Mar 5-15) | **Complete** | 70/70 |
| **P2 — Production + Expansion** | 4-6 (Mar 17-Apr 25) | Next up | 0/45 |
| **P3 — Personalization + Growth** | 7-9 (Apr 28-Jun 5) | Planned | 0/41 |

**Overall: 101/124 Linear issues done (81.5%)**

---

## Sprint 1 — Foundation + Context Library ✅ COMPLETE

### Infrastructure
- [x] Next.js 16 app (App Router, React 19, TypeScript, Tailwind CSS v3, shadcn/ui)
- [x] Supabase local stack with 18 migrations
- [x] Full schema: organizations, org_members, integrations, context_items (pgvector), sessions, session_context_links, inbox_items, action_items, conversations, chat_messages, agent_runs, audit_log, context_chunks, credit_balances, usage_logs
- [x] Row Level Security on all tables via `get_user_org_ids()` helper
- [x] Auto org creation trigger on user signup
- [x] TypeScript types generated from schema (`src/lib/database.types.ts`)
- [x] GitHub Actions CI (typecheck → lint → test on every PR)
- [x] Vitest with jsdom — 43 unit test files, 492 tests
- [x] Playwright E2E — 13 spec files
- [x] AI eval suites — extraction, retrieval, agent, performance, context-health
- [x] Husky pre-commit hooks

### Auth
- [x] Supabase SSR client (server, browser, admin, service role)
- [x] Middleware: session refresh + route protection
- [x] Login page (`/login`) — email/password + Google OAuth
- [x] Signup page (`/signup`) — creates org via DB trigger
- [x] Forgot password + reset password flows
- [x] Auth callback route (`/auth/callback`)
- [x] Password validation with strength checks

### Context Library
- [x] File parsing (`src/lib/ingest/parse.ts`): PDF, DOCX, TXT, MD
- [x] AI extraction (`src/lib/ai/extract.ts`): `generateObject` → title, summaries, entities, sentiment
- [x] Embeddings (`src/lib/ai/embed.ts`): single + batch embedding (1536-dim)
- [x] Intelligent document chunking (parent-child strategy, ~400/1500 tokens)
- [x] Inngest 7-step pipeline: fetch → extract → chunk → embed chunks → embed item → inbox → link sessions
- [x] Upload API (`POST /api/ingest/upload`): upload → parse → insert → trigger Inngest
- [x] Context library page (`/context`): filters, pagination, bulk ops, status indicators
- [x] Context detail page (`/context/[id]`)
- [x] Meeting transcript upload page (`/context/upload-meeting`)

### Onboarding
- [x] 4-step onboarding flow: welcome → connect tools → first session → complete
- [x] localStorage completion tracking
- [x] Redirect logic for completed/incomplete users

---

## Sprint 2 — Integrations + Chat ✅ COMPLETE

### Integrations
- [x] Nango Connect UI embedded on `/integrations` page
- [x] Google Drive integration (push notifications, incremental sync, watch renewal)
- [x] Linear integration (GraphQL queries, HMAC webhook verification, issues/projects/cycles)
- [x] Discord integration (guild sync, message batching, Ed25519 webhook verification)
- [x] Granola integration (webhook daemon, payload validation, token verification)
- [x] Nango webhook handler (`POST /api/webhooks/nango`)
- [x] Per-provider sync endpoints (`/api/integrations/{provider}/sync`)
- [x] Integration save/delete/connect-session APIs

### Chat
- [x] Main chat endpoint (`POST /api/chat`) — ToolLoopAgent with rate limiting
- [x] Session-scoped chat (`POST /api/chat/session/[id]`)
- [x] Hybrid search: vector + full-text with RRF scoring (item-level + chunk-level)
- [x] AI tools: `search_context` + `get_document` with proper filtering
- [x] Chat UI with `useChat` hook, model selector (Haiku/Sonnet/Opus/GPT-4o/Gemini)
- [x] Source citations with relevance scores
- [x] Tool call panels with expandable UI
- [x] Multi-conversation support with history persistence
- [x] AI Elements: tool cards, message rendering, code blocks with Shiki

---

## Sprint 3 — Inbox + Sessions + Team ✅ COMPLETE

### Inbox
- [x] AI-driven inbox generation (`src/lib/inbox/generate.ts`) — Claude Haiku prioritization
- [x] Simple extraction-based inbox (`src/lib/inbox.ts`) — action items + decisions
- [x] Inbox UI (`/inbox`) with inbox-list component
- [x] Deduplication by context_item_id + type
- [x] Priority levels: urgent, high, normal, low
- [x] Item types: action_item, decision, mention, new_context, overdue
- [x] Inbox generate API (`POST /api/inbox/generate`)

### Sessions
- [x] Session CRUD APIs (`/api/sessions`, `/api/sessions/[id]`)
- [x] Session workspace UI with scoped chat + context panel
- [x] Session members API (`/api/sessions/[id]/members`)
- [x] Session context linking API (`/api/sessions/[id]/context`) — manual add/remove
- [x] Auto-linking pipeline: Inngest step 7 matches content to sessions via AI (SessionMatchSchema)
- [x] Session-scoped search (`src/lib/db/session-search.ts`)

### Team
- [x] Team management UI (`/settings/team`) — members, roles, invitations
- [x] Invite API (`/api/team/invite`) — email invitations
- [x] Profile settings (`/settings/profile`) — name, password
- [x] Audit log (`/settings/audit`) — paginated action tracking

### Billing
- [x] Stripe integration (`stripe` package, `src/lib/stripe.ts`)
- [x] Stripe webhook handler (`POST /api/webhooks/stripe`)
- [x] Credit balance API (`GET /api/billing/credits`)
- [x] Checkout session API (`POST /api/billing/checkout`)
- [x] Billing settings page (`/settings/billing`) — balance display + credit purchase
- [x] Credit packages: 100 ($9.99), 500 ($39.99), 2,000 ($129.99)

### Analytics & Observability
- [x] Analytics dashboard (`/analytics`) — KPIs, agent metrics, context health
- [x] KPI computation with threshold-based health checks (pass/warn/fail)
- [x] Agent run tracking (`agent_runs` table)
- [x] Audit logging (fire-and-forget, org/user/action tracking)
- [x] Rate limiting (in-memory token bucket)

### Additional
- [x] Actions page (`/actions`) — action item tracking (pending/done/cancelled)
- [x] Features/status page (`/features`) — GSAP-animated board presentation
- [x] API docs page (`/api-docs`)
- [x] Command palette
- [x] Breadcrumb navigation
- [x] Theme toggle (dark/light)
- [x] Error boundaries and loading states
- [x] 404 page

---

## Integration Improvements (Mar 17) ✅ COMPLETE

### Sync Progress Indicator
- [x] SSE streaming from sync endpoint — real-time phase updates
- [x] Per-item progress bar with title and elapsed time
- [x] Phase-based UI: Fetching → Processing → Complete

### Google Drive Expansion
- [x] Added support for uploaded PDFs (parsed via pdf-parse)
- [x] Added support for DOCX files (parsed via mammoth)
- [x] Added support for XLSX, TXT, Markdown, CSV files
- [x] Debug messages show file type labels

### Integration Limits
- [x] Slack: 3 channels → 20 channels, 50 msgs → 200 msgs per channel
- [x] GitHub: 4 repos → 10 repos, 8 issues → 15 issues per repo
- [x] Added Discord and Granola to onboarding tool selection
- [x] Google Calendar and Notion marked as "Coming Soon"

### Nango Sync Engine Migration (Phase 1)
- [x] Enhanced webhook handler as primary ingestion path
- [x] Provider data mappers with unified schema
- [x] Idempotent record processing (dedup by source_id)
- [x] Inngest pipeline triggered from webhooks (async processing)
- [x] Sync trigger API for immediate background sync
- [x] Migration plan documented in `docs/plans/2026-03-17-nango-sync-migration.md`

### Phase 6: Lifecycle UI
- [x] Version history API + timeline component on context detail pages
- [x] Content health dashboard with freshness metrics
- [x] Stale items list with action recommendations

---

## Sprint 4 — Production Readiness ⏳ IN PROGRESS (Mar 17-28)

### Completed
- [x] PROD-222: Credit deduction middleware
- [x] PROD-223: Usage logging on every AI call
- [x] PROD-227: Per-org rate limiting with tiers
- [x] PROD-228: Usage history UI in billing

### In Progress
- [ ] PROD-224: Production Supabase (manual setup needed — see `docs/production-setup.md`)
- [ ] PROD-225: Stripe production keys (manual setup needed — see `docs/production-setup.md`)
- [ ] PROD-226: Inngest production deploy (manual setup needed — see `docs/production-setup.md`)

### Documentation
- [x] Production setup checklist (`docs/production-setup.md`)
- [x] Environment variables reference (`.env.example`)
- [x] Vercel configuration (`vercel.json` — function durations, security headers, crons)

### Remaining
- [ ] Vercel deployment + CI/CD
- [ ] Mobile responsive polish
- [ ] SEO + meta tags + OG images
- [ ] Nango webhook secret verification
- [ ] E2E billing flow test
- [ ] E2E production smoke tests
- [ ] Webhook idempotency

---

## Codebase Metrics (as of 2026-03-16)

| Metric | Value |
|--------|-------|
| Lines of code | 33,002 |
| Source files (.ts/.tsx) | 209 |
| API routes | 40 |
| App pages | 26 |
| Custom components | 19 |
| UI components (shadcn) | 20 |
| DB migrations | 18 |
| Unit test files | 43 |
| Unit tests | 492 |
| E2E spec files | 13 |
| AI eval suites | 5 |
| Commits | 99 |
| Dependencies | 41 prod + 18 dev |
| TODO/FIXME | 0 |
| Days from first commit | 11 |

---

## Environment Variables

```bash
# .env.local (never committed)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AI_GATEWAY_API_KEY=...
NANGO_SECRET_KEY=...
NEXT_PUBLIC_NANGO_PUBLIC_KEY=...
NANGO_WEBHOOK_SECRET=...
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...    # stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Test Coverage

| Category | Files | Tests | Framework |
|----------|-------|-------|-----------|
| Unit tests | 43 | 492 | Vitest |
| E2E tests | 13 | ~120 | Playwright |
| AI evals | 5 suites | — | Vitest |
| Eval fixtures | 3 | — | Transcripts, expected extractions, canary docs |

---

## Key File Locations

| What | Where |
|------|--------|
| DB migrations (18) | `supabase/migrations/` |
| Supabase clients | `src/lib/supabase/{server,client}.ts` |
| Auth middleware | `src/middleware.ts` |
| AI config (models) | `src/lib/ai/config.ts` |
| AI extraction | `src/lib/ai/extract.ts` |
| AI embedding | `src/lib/ai/embed.ts` |
| AI tools | `src/lib/ai/tools.ts` |
| Inngest pipeline | `src/lib/inngest/functions/process-context.ts` |
| Document chunker | `src/lib/pipeline/chunker.ts` |
| Extraction schema | `src/lib/pipeline/extraction-schema.ts` |
| Hybrid search | `src/lib/db/search.ts` |
| Integrations | `src/lib/integrations/{linear,discord,google-drive,granola}.ts` |
| Inbox generation | `src/lib/inbox/generate.ts` |
| KPI computation | `src/lib/kpi/compute.ts` |
| Stripe config | `src/lib/stripe.ts` |
| Sidebar nav | `src/components/sidebar-nav.tsx` |
| Chat interface | `src/components/chat-interface.tsx` |
| Session workspace | `src/components/session-workspace.tsx` |
| Context library | `src/components/context-library.tsx` |
| Sprint issues | `docs/linear-sprint-issues.md` |
| P2-P3 execution plan | `docs/plans/2026-03-15-p2-p3-execution-plan.md` |

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
pnpm test              # vitest run (unit tests)
pnpm test:coverage     # coverage report
pnpm typecheck         # tsc --noEmit

# E2E
npx playwright test    # run all E2E tests

# AI Evals
pnpm eval              # all evals
pnpm eval:extraction   # extraction quality
pnpm eval:retrieval    # search quality
pnpm eval:agent        # agent behavior
pnpm eval:health       # context health KPIs

# Stripe (local dev)
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```
