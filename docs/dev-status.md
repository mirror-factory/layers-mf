# Development Status

Last updated: 2026-03-22

## Phase Summary

| Phase | Sprints | Status | Issues |
|-------|---------|--------|--------|
| **P1 — Prototype** | 1-3 (Mar 5-15) | **Complete** | 70/70 |
| **P2 — Production + Expansion** | 4-6 (Mar 17) | **Complete** | 45/45 |
| **P3 — Personalization + Growth** | 7-9 (Mar 19-22) | **Complete** | 41/41 |

**Overall: 156/156 Linear issues done (100%)**
**All sprints complete. Launch prep in progress.**

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
- [x] Vitest with jsdom — 43 unit test files, 713 tests
- [x] Playwright E2E — 16 spec files
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

## Sprint 4 — Production Readiness ✅ COMPLETE (Mar 17)

### Code Complete
- [x] PROD-222: Credit deduction middleware
- [x] PROD-223: Usage logging on all AI calls
- [x] PROD-227: Per-org tier-based rate limiting
- [x] PROD-228: Usage history UI in billing
- [x] Webhook idempotency for all providers
- [x] Nango webhook signature verification
- [x] E2E billing, settings, production smoke tests
- [x] Selective sync configuration per integration
- [x] Production setup checklist + .env.example

### Manual Setup Needed
- [ ] PROD-224: Production Supabase project
- [ ] PROD-225: Stripe live keys
- [ ] PROD-226: Inngest Vercel integration

---

## Sprint 5 — Integrations Expansion ✅ COMPLETE (Mar 17)
- [x] Notification preferences + settings page
- [x] SEO metadata on all pages
- [x] Mobile responsive polish (chat, sessions, all settings)
- [x] Custom error/404 pages
- [x] Daily digest email generation + preview
- [x] Command palette updated (20 commands, keyword search)
- [x] API docs expanded (63 endpoints across 13 categories)
- [x] Webhook health dashboard on analytics

---

## Sprint 6 — Session Agents + Monitoring ✅ COMPLETE (Mar 17)
- [x] Session insights data model + API + UI
- [x] Cross-source connection finder (AI-powered)
- [x] Organization settings with danger zone
- [x] Saved searches with team sharing
- [x] Entity visualization (interactive chips)
- [x] Export system (Markdown + JSON)
- [x] Keyboard shortcuts reference panel

---

## Sprint 7 — Ditto Personalization ✅ COMPLETE (Mar 19)
- [x] User interaction tracking (search, click, dismiss, dwell, chat_query)
- [x] Client-side tracking hook with sendBeacon
- [x] Ditto profile generation (AI from interaction patterns)
- [x] Ditto profile page (/ditto) with editable preferences
- [x] "For You" suggestions widget on dashboard
- [x] Personalized inbox ranking via Ditto profile
- [x] Personalized search boost (source preference weighting)

## Sprint 8 — Self-Service ✅ COMPLETE (Mar 19)
- [x] Plan selection on signup (Free/Starter/Pro)
- [x] Public landing page with hero, features, pricing
- [x] Marketing layout for unauthenticated visitors
- [x] Pricing page with feature comparison + FAQ
- [x] API key management (generate/revoke with SHA-256 hashing)
- [x] Subscription management API (create/cancel via Stripe)
- [x] Monthly credit reset cron
- [x] /features and /pricing now public

## Sprint 9 — Canvas + Polish ✅ COMPLETE (Mar 22)
- [x] Canvas data model + API (canvases, items, connections)
- [x] Canvas workspace UI (pan/zoom, drag items, connections, minimap)
- [x] User guide page (/guide)
- [x] Launch checklist (docs/launch-checklist.md)
- [x] Accessibility audit (ARIA labels, focus management, skip-to-content)
- [x] Subscription management (Stripe checkout, cancel, credit reset)

## Additional Shipped (Mar 22)
- [x] Agent specialization templates (6 templates: sales call, sprint retro, meeting actions, onboarding, weekly digest, doc analyzer)
- [x] Compound knowledge loop (AI outputs → searchable context items)
- [x] Google Calendar integration (active, 30-day window)
- [x] Notion integration (active, block-by-block content)
- [x] Multi-tenant webhook fix (workspace ID matching)
- [x] Canvas workspace with minimap

---

## Granger Sprint Progress (Started 2026-03-30)

Full spec: `docs/GRANGER-SPEC.md`

### Sprint 1: Foundation — **COMPLETE**
- [x] 9-model matrix (3 providers × 3 tiers), TASK_MODELS, per-partner gateway stub
- [x] Priority document system (5 docs + loader + wired into chat routes)
- [x] Database migrations (priority_documents, credentials, approval_queue, partner_settings + column additions)
- [x] Direct API clients: Granola (grn_ keys) + Linear (@linear/sdk)
- [x] Approval system (propose_action tool + queue API + UI + /approvals page)

### Sprint 2: APIs + Conversation Loop — **COMPLETE**
- [x] Direct API clients: Discord (REST v10), Notion (@notionhq/client), Gmail + Drive (googleapis OAuth)
- [x] Google OAuth callback route with shared token storage
- [x] Conversation history compaction (Haiku-based, incremental, fire-and-forget)
- [x] 13 agent tools total (6 read + 4 write + 3 existing)
- [x] Test mock fixes for createGateway, priority-docs, compact

### Sprint 3: Discord Bot + Proactive Intelligence — **COMPLETE**
- [x] Discord HTTP interactions endpoint (Ed25519 verification, deferred responses)
- [x] Slash commands: /ask, /status, /tasks, /digest
- [x] Command registration script + API endpoint
- [x] Morning digest cron (7 AM weekdays, personalized per partner, #granger-digest)
- [x] Overdue detection + alerts cron (every 2h, #granger-alerts)
- [x] Granola polling cron (every 15min, auto-ingest transcripts)
- [x] Discord approval reactions (✅/❌) + DM conversations
- [x] Discord user → Supabase user mapping via partner_settings

### Sprint 4: Polish + Extraction Pipeline — **COMPLETE**
- [x] Expand extraction schema (emotional_signals, tacit_observations, confidence_score, source_quote)
- [x] Nightly synthesis cron (2 AM, Opus 4.6, 4K token cap, compound knowledge loop)
- [x] Pattern detection (topics in 3+ items without resolution, unresolved-first sorting)
- [x] Partner settings page (/settings/api-keys) — Discord ID, Gateway key, API keys, Google OAuth
- [x] Settings API routes (partner + credentials)
- [x] Nango removal checklist documented (docs/plans/nango-removal-checklist.md)
- [ ] Pre-meeting prep via Google Calendar (deferred to post-launch)
- [ ] Remove Nango code + @nangohq dependencies (follow checklist)
- [ ] Deploy to production Vercel + Supabase
- [ ] Onboard Kyle and Bobby

### Sprint 5: Notebook Features — **COMPLETE** (2026-03-30 evening)
- [x] TipTap rich text editor for context library documents
- [x] Document versioning (version history, restore previous versions)
- [x] Majority-approval editing (edit proposals, 2/3 vote, auto-apply)
- [x] Chat sharing (share conversations with team members)
- [x] Chat export (Markdown + JSON download)
- [x] Code sandbox tool (write_code + CodeSandbox component with syntax highlighting)
- [x] Permission system (per-service read/write toggles at /settings/permissions)
- [x] Scaffolding templates (3 org templates: Startup, Agency, Solo)
- [x] Chat SDK Discord bot (replaces custom implementation)
- [x] Desktop notifications (browser native + sonner toast fallback)
- [x] Linear status check cron (every 3 min with Run Now button)
- [x] Scheduled actions system (/schedules page, schedule via chat)
- [x] Full "Layers" → "Granger" rebrand (20+ files)
- [x] Dark mode fixes (inbox, approvals, suggestions)
- [x] Context library fix (admin client, user_tags column removal)
- [x] Demo mode (credit bypass, inline upload processing)

### Post-Sprint: Production Deployment Checklist
- [ ] Set env vars: DISCORD_BOT_TOKEN, DISCORD_PUBLIC_KEY, DISCORD_APPLICATION_ID, DISCORD_GUILD_ID
- [ ] Set env vars: DISCORD_DIGEST_CHANNEL_ID, DISCORD_ALERTS_CHANNEL_ID
- [ ] Set env vars: GRANOLA_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- [ ] Register Discord commands: `tsx scripts/register-discord-commands.ts`
- [ ] Set Discord interactions URL in Developer Portal
- [ ] Create #granger-digest and #granger-alerts Discord channels
- [ ] Each partner: link Discord ID + add API keys at /settings/api-keys
- [ ] Run `pnpm db:reset` on production Supabase to apply new migrations
- [ ] Verify crons firing in Vercel dashboard

---

## Codebase Metrics (as of 2026-03-22)

| Metric | Value |
|--------|-------|
| Lines of code | 33,002 |
| Source files (.ts/.tsx) | 209 |
| API routes | 66 |
| App pages | 38 |
| Custom components | 19 |
| UI components (shadcn) | 20 |
| DB migrations | 29 |
| Unit test files | 73 |
| Unit tests | 819 |
| E2E spec files | 16 |
| AI eval suites | 5 |
| Commits | 122 |
| Dependencies | 41 prod + 18 dev |
| TODO/FIXME | 0 |
| Days from first commit | 17 |

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
| Unit tests | 73 | 819 | Vitest |
| E2E tests | 16 | ~150 | Playwright |
| AI evals | 5 suites | — | Vitest |
| Eval fixtures | 3 | — | Transcripts, expected extractions, canary docs |

---

## Key File Locations

| What | Where |
|------|--------|
| DB migrations (29) | `supabase/migrations/` |
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
