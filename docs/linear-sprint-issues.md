# Layers Platform — Linear Sprint Issues

Handoff document for Linear agent. All issues are organized by Project → Epic → Issue.
Dates assume start: **March 5, 2026**.

---

## Project: Layers P1 — Internal MVP

**Goal:** Daily active use by all 3 Mirror Factory team members by end of Sprint 3.
**Timeline:** 6 weeks (March 5 – April 15, 2026)
**Team:** Mirror Factory (3 members)

---

## EPICS

| ID | Title | Sprint | Start | Due |
|----|-------|--------|-------|-----|
| E1 | Foundation & Infrastructure | Sprint 1 | Mar 5 | Mar 11 |
| E2 | Context Library & Pipeline | Sprint 1 | Mar 9 | Mar 18 |
| E3 | Integrations | Sprint 2 | Mar 19 | Mar 25 |
| E4 | Chat Interface | Sprint 2 | Mar 23 | Apr 1 |
| E5 | Inbox | Sprint 3 | Apr 2 | Apr 8 |
| E6 | Sessions & Workspaces | Sprint 3 | Apr 5 | Apr 15 |
| E7 | Team & Auth | Sprint 3 | Apr 2 | Apr 10 |

---

## SPRINT 1 — Foundation + Context Library
**Dates:** March 5–18, 2026
**Success metric:** Upload a meeting transcript → see it processed into structured metadata → browse it in the library.

---

### E1 — Foundation & Infrastructure

---

#### ISSUE: Setup Next.js project with full stack dependencies

**Type:** Task
**Priority:** Urgent
**Labels:** infrastructure, backend, sprint-1
**Start:** Mar 5 | **Due:** Mar 6
**Estimate:** 2 points

**Description:**
Install and configure all core dependencies needed for the Layers platform: Supabase client, Vercel AI SDK, AI Elements, Nango, and Stripe. Configure environment variables for local development.

**Acceptance Criteria:**
- [ ] `@supabase/supabase-js` and `@supabase/ssr` installed and configured
- [ ] `ai` (Vercel AI SDK) installed
- [ ] `@ai-sdk/openai` and `@ai-sdk/anthropic` providers installed
- [ ] `@nangohq/node` and `@nangohq/frontend` installed
- [ ] `stripe` installed
- [ ] `.env.local` populated with all required keys
- [ ] `pnpm dev` runs without errors

**Why:**
Every feature in Layers depends on these four services. Getting the dependency graph right before writing feature code prevents refactoring later and ensures the team is building on a stable foundation from day one.

---

#### ISSUE: Configure Supabase client (server + browser)

**Type:** Task
**Priority:** Urgent
**Labels:** infrastructure, database, sprint-1
**Start:** Mar 5 | **Due:** Mar 6
**Estimate:** 2 points

**Description:**
Set up Supabase client utilities for both server-side (API routes, Server Components) and client-side usage using `@supabase/ssr`. Implement the cookie-based session pattern required for App Router.

**Acceptance Criteria:**
- [ ] `src/lib/supabase/server.ts` — createServerClient for API routes
- [ ] `src/lib/supabase/client.ts` — createBrowserClient for client components
- [ ] `src/middleware.ts` — session refresh middleware
- [ ] Auth session persists across page refreshes
- [ ] TypeScript types generated from Supabase schema (`database.types.ts`)

**Why:**
The `@supabase/ssr` pattern is required for Next.js App Router — the old `@supabase/auth-helpers-nextjs` package is deprecated. Getting this right prevents auth bugs and hydration errors down the line.

---

#### ISSUE: Implement authentication (login, signup, protected routes)

**Type:** Feature
**Priority:** Urgent
**Labels:** auth, frontend, sprint-1
**Start:** Mar 6 | **Due:** Mar 8
**Estimate:** 3 points

**Description:**
Build login and signup pages using Supabase Auth. Implement middleware-based route protection so unauthenticated users are redirected to login. Support email/password auth for P1 (OAuth providers in P2).

**Acceptance Criteria:**
- [ ] `/login` page with email + password form
- [ ] `/signup` page with email + password + org name form
- [ ] On signup: creates `organization` + `org_member` records for the new user
- [ ] Middleware redirects unauthenticated users from `/(dashboard)/*` to `/login`
- [ ] Middleware redirects authenticated users away from `/login` and `/signup`
- [ ] Session cookie set correctly, survives refresh

**Why:**
Layers is a multi-tenant platform — every piece of data is org-scoped via RLS. Auth must be correct before any data operations are possible. Building it first means every feature built after it automatically inherits org isolation.

---

#### ISSUE: Set up GitHub Actions CI pipeline

**Type:** Task
**Priority:** High
**Labels:** infrastructure, devops, sprint-1
**Start:** Mar 6 | **Due:** Mar 7
**Estimate:** 2 points

**Description:**
Create a GitHub Actions workflow that runs on every PR and push to `main`. Pipeline should: install dependencies, run type checking, run linting, and run unit tests. Fail fast if any check fails.

**Acceptance Criteria:**
- [ ] `.github/workflows/ci.yml` created
- [ ] Runs `pnpm typecheck` (tsc --noEmit)
- [ ] Runs `pnpm lint` (eslint)
- [ ] Runs `pnpm test` (vitest)
- [ ] Fails PR merge if any check fails
- [ ] Runs in < 3 minutes on a clean repo

**Why:**
Unpushed, untested code is unvalidated code. CI ensures every change is verified before it reaches main, catching type errors and broken logic before they compound. This is especially important for a solo/small team where there's no second pair of eyes on every change.

---

#### ISSUE: Set up Vitest for unit testing

**Type:** Task
**Priority:** High
**Labels:** testing, infrastructure, sprint-1
**Start:** Mar 6 | **Due:** Mar 7
**Estimate:** 1 point

**Description:**
Install and configure Vitest as the unit testing framework. Set up test utilities, mocking patterns for Supabase and AI SDK, and initial test for the `cn()` utility to verify the pipeline works end-to-end.

**Acceptance Criteria:**
- [ ] `vitest` and `@vitejs/plugin-react` installed
- [ ] `vitest.config.ts` configured for Next.js + TypeScript
- [ ] `src/lib/utils.test.ts` passes as smoke test
- [ ] `pnpm test` command works
- [ ] `pnpm test:coverage` generates coverage report

**Why:**
The extraction pipeline (generateObject → schema validation) is the highest-risk component in Layers. Vitest unit tests let us validate schema transformations and utility functions in milliseconds without spinning up the full app, making iteration fast and regressions visible.

---

### E2 — Context Library & Pipeline

---

#### ISSUE: Build registry pipeline — Step 1: Ingest

**Type:** Feature
**Priority:** Urgent
**Labels:** backend, pipeline, sprint-1
**Start:** Mar 9 | **Due:** Mar 11
**Estimate:** 3 points

**Description:**
Create the `/api/context/ingest` endpoint that receives raw content from any source (Granola, Linear, upload), creates a `ContextItem` with `status: pending`, and triggers the processing pipeline. This is the entry point for all data into Layers.

**Acceptance Criteria:**
- [ ] `POST /api/context/ingest` accepts `{ source, content, metadata }`
- [ ] Validates request with HMAC secret (prevent unauthorized ingestion)
- [ ] Creates `ContextItem` record with `status: pending`
- [ ] Item immediately visible in context library as "processing"
- [ ] Triggers async processing (Step 2)
- [ ] Returns `{ id, status }` immediately (< 200ms)
- [ ] Unit test: validates schema, rejects invalid source types

**Why:**
The ingest endpoint is the foundation of the entire data layer. Making it fast and non-blocking is critical — the user should see new content appear immediately, even before AI processing completes. This "optimistic display" pattern makes the product feel responsive.

---

#### ISSUE: Build registry pipeline — Step 2: Extract

**Type:** Feature
**Priority:** Urgent
**Labels:** backend, pipeline, ai, sprint-1
**Start:** Mar 11 | **Due:** Mar 13
**Estimate:** 5 points

**Description:**
Implement the AI extraction step using `generateObject()` with the `ExtractionSchema`. Extracts people, decisions, action items, topics, projects, dates, and a summary from raw content. Uses `gpt-4o-mini` for cost efficiency.

**Acceptance Criteria:**
- [ ] Zod `ExtractionSchema` defined (people, decisions, actionItems, topics, projects, dates, sentiment, summary)
- [ ] `generateObject()` call with gpt-4o-mini via AI Gateway
- [ ] Extracted entities stored in `context_items.entities` JSONB
- [ ] `description_short` and `description_long` generated from summary
- [ ] Status updated to `processing` during, `ready` or `error` after
- [ ] Unit test: runs extraction against 3 fixture transcripts, validates schema output
- [ ] Error handling: retries once on failure, sets `status: error` on second failure

**Why:**
This is the highest-risk step in the pipeline — extraction quality directly determines the value of every downstream feature (inbox, search, sessions). Building it with a defined Zod schema enforces consistent output structure, making the data reliable for agents to reason over.

---

#### ISSUE: Build registry pipeline — Step 3: Embed

**Type:** Feature
**Priority:** Urgent
**Labels:** backend, pipeline, ai, sprint-1
**Start:** Mar 13 | **Due:** Mar 14
**Estimate:** 2 points

**Description:**
Generate vector embeddings for each context item using `embed()` with `text-embedding-3-small`. Store the 1536-dimensional vector in the `embedding` pgvector column for semantic search.

**Acceptance Criteria:**
- [ ] `embed()` call with `openai/text-embedding-3-small` via AI Gateway
- [ ] Embeds `description_long` (higher signal than raw content)
- [ ] Stores result in `context_items.embedding` (vector(1536))
- [ ] HNSW index confirmed working (query returns results in < 100ms on 1000 items)
- [ ] Unit test: embedding dimensions validated, cosine similarity > 0.8 for related content

**Why:**
Embeddings are what make Layers' search feel like magic — "what did we decide about pricing?" returns semantically relevant results even without exact keyword matches. Embedding `description_long` rather than raw content improves signal quality because it's already been distilled by the extraction step.

---

#### ISSUE: Build manual file upload (drag-and-drop)

**Type:** Feature
**Priority:** High
**Labels:** frontend, sprint-1
**Start:** Mar 12 | **Due:** Mar 15
**Estimate:** 3 points

**Description:**
Build a file upload interface that accepts DOCX, PDF, and TXT files. Extract text content client-side or server-side and send to the ingest pipeline. This is the P1 method for getting content into Layers without live integrations.

**Acceptance Criteria:**
- [ ] Drag-and-drop upload zone on the library page
- [ ] Accepts `.docx`, `.pdf`, `.txt` files (max 10MB)
- [ ] Text extraction: PDF via `pdf-parse`, DOCX via `mammoth`
- [ ] Sends extracted text to `POST /api/context/ingest`
- [ ] Upload progress indicator
- [ ] Error state for unsupported file types or extraction failures

**Why:**
The Granola and Linear integrations take time to set up. File upload gives the team an immediate way to test the pipeline with real meeting transcripts from day one, enabling daily use of Layers before any live integration is connected.

---

#### ISSUE: Build context library browser UI

**Type:** Feature
**Priority:** High
**Labels:** frontend, sprint-1
**Start:** Mar 14 | **Due:** Mar 18
**Estimate:** 4 points

**Description:**
Build the context library browsing interface: a grid of context item cards filterable by source type, content type, and date. Each card shows the title, source badge, summary, and processing status.

**Acceptance Criteria:**
- [ ] `/library` page with `ContextGrid` component
- [ ] `ContextCard` shows: title, source badge (color-coded), description_short, status indicator, date
- [ ] Filter bar: by source type, content type, date range
- [ ] Loading skeleton states while fetching
- [ ] `/library/[id]` detail page shows full entities, raw content toggle
- [ ] Empty state for new orgs
- [ ] Responsive layout (works on laptop screen)

**Why:**
The library is the foundation of trust in Layers — if team members can't see and verify what data has been ingested and how it was processed, they won't trust the AI outputs. Transparency into the raw data is what makes agents feel accountable rather than magical-but-unverifiable.

---

#### ISSUE: Write AI eval set for extraction pipeline

**Type:** Task
**Priority:** High
**Labels:** testing, ai, sprint-1
**Start:** Mar 14 | **Due:** Mar 18
**Estimate:** 3 points

**Description:**
Create a set of 10 real (anonymized) meeting transcripts with manually annotated expected outputs. Use these as regression tests for the extraction pipeline — run evals before any ExtractionSchema change.

**Acceptance Criteria:**
- [ ] 10 transcript fixtures in `tests/fixtures/transcripts/`
- [ ] Expected output JSON for each in `tests/fixtures/expected/`
- [ ] `tests/evals/extraction.eval.ts` runner that compares actual vs expected
- [ ] Scoring: % of action items correctly identified, % of decisions captured
- [ ] Baseline score documented in `docs/eval-results.md`
- [ ] Fails CI if score drops more than 10% from baseline

**Why:**
Extraction quality is the #1 technical risk in the platform. Without evals, schema changes and prompt tweaks are flying blind. This eval set is the feedback loop that lets us improve quality with confidence — it's the difference between "I think this works" and "I know this works."

---

## SPRINT 2 — Integrations + Chat
**Dates:** March 19 – April 1, 2026
**Success metric:** Connect Google Drive + Linear. Ask "what are our open issues?" and get a sourced answer.

---

### E3 — Integrations

---

#### ISSUE: Integrate Nango Connect UI

**Type:** Feature
**Priority:** Urgent
**Labels:** integrations, frontend, sprint-2
**Start:** Mar 19 | **Due:** Mar 21
**Estimate:** 3 points

**Description:**
Embed Nango's Connect UI on the integrations page so users can authorize external services (Google Drive, Linear, Discord) with one click. Store connection references in the `integrations` table.

**Acceptance Criteria:**
- [ ] `/integrations` page with provider cards (Google Drive, Linear, Discord, Granola)
- [ ] `@nangohq/frontend` Connect UI triggers on "Connect" click
- [ ] On successful connection: creates `Integration` record with `nango_connection_id`
- [ ] Connection status indicators (connected / error / syncing)
- [ ] Disconnect flow removes integration and marks for cleanup

**Why:**
Nango eliminates 2-4 weeks of OAuth plumbing per integration. Getting the Connect UI working unlocks all subsequent integration work without writing a single OAuth flow from scratch.

---

#### ISSUE: Google Drive integration + sync

**Type:** Feature
**Priority:** Urgent
**Labels:** integrations, backend, sprint-2
**Start:** Mar 21 | **Due:** Mar 25
**Estimate:** 4 points

**Description:**
Set up Nango sync for Google Drive. When a new or updated Doc/Sheet is detected, ingest it through the context pipeline. Handle Google Docs text extraction and Sheets JSON conversion.

**Acceptance Criteria:**
- [ ] Nango webhook receiver at `POST /api/integrations/webhook`
- [ ] Google Docs → plain text extraction via Nango
- [ ] Google Sheets → structured JSON
- [ ] New/updated files trigger `POST /api/context/ingest`
- [ ] File metadata stored in `source_metadata` (owner, folder, last modified)
- [ ] Integration test: upload a Google Doc, confirm it appears in context library within 60s

**Why:**
Google Drive is where Mirror Factory's strategy docs, proposals, and shared knowledge lives. Getting Drive connected first maximizes the context available to the AI from day one.

---

#### ISSUE: Linear integration + webhook

**Type:** Feature
**Priority:** High
**Labels:** integrations, backend, sprint-2
**Start:** Mar 22 | **Due:** Mar 26
**Estimate:** 3 points

**Description:**
Configure Linear webhooks via Nango. Ingest issue creates, updates, and comments as context items. Link issues to relevant sessions based on project names.

**Acceptance Criteria:**
- [ ] Linear webhook events: Issues, Comments, Projects, Cycles
- [ ] HMAC-SHA256 signature verification on all webhook payloads
- [ ] Issue content mapped to `ContextItem` (title, description, status, assignee)
- [ ] Issue status changes create `InboxItem` for assignee
- [ ] Integration test: create a Linear issue, confirm it appears in Layers within 10s

**Why:**
Linear is the team's task tracker — it contains the canonical list of what work is happening and who owns it. Ingesting Linear means agents can answer "what's overdue?" and "what did we commit to this sprint?" without anyone manually updating Layers.

---

#### ISSUE: Granola webhook daemon setup

**Type:** Task
**Priority:** High
**Labels:** integrations, backend, sprint-2
**Start:** Mar 22 | **Due:** Mar 24
**Estimate:** 2 points

**Description:**
Set up the `granola-webhook` open-source daemon that monitors Granola's local cache file and sends HTTP webhooks to Layers when new meeting notes appear. Document the setup process for the team.

**Acceptance Criteria:**
- [ ] `granola-webhook` daemon installed and configured
- [ ] Daemon points to `POST /api/context/ingest` with auth secret
- [ ] New Granola note triggers ingest within 30 seconds of creation
- [ ] Setup documented in `docs/granola-setup.md`
- [ ] Abstract ingestion interface so swapping to official API later is config-only

**Why:**
Meeting transcripts are the highest-value content for Layers — decisions, action items, and context are densest in meeting notes. The granola-webhook daemon gets this flowing without requiring an Enterprise Granola plan.

---

### E4 — Chat Interface

---

#### ISSUE: Build hybrid search (vector + full-text)

**Type:** Feature
**Priority:** Urgent
**Labels:** backend, search, ai, sprint-2
**Start:** Mar 24 | **Due:** Mar 27
**Estimate:** 4 points

**Description:**
Implement hybrid search combining pgvector cosine similarity, PostgreSQL full-text search (tsvector), and metadata filtering. Use Reciprocal Rank Fusion (RRF) to merge rankings from both methods.

**Acceptance Criteria:**
- [ ] `POST /api/context/search` endpoint
- [ ] Generates query embedding via `embed()` (text-embedding-3-small)
- [ ] Vector similarity search on `embedding` column (HNSW, cosine)
- [ ] Full-text search on `title + description_long + raw_content`
- [ ] Metadata filter: source_type, content_type, date range
- [ ] RRF score merges vector + full-text results
- [ ] Returns top 10 results with relevance scores
- [ ] Response time < 500ms on 1000 context items
- [ ] Unit test: "pricing decision" query returns the correct fixture item in top 3

**Why:**
Neither pure vector search (misses exact terms) nor pure full-text search (misses semantic meaning) is sufficient for a knowledge base. Hybrid search with RRF delivers the best of both: it finds "Q2 revenue target" when someone asks "what's our sales goal?" and "meeting with Sarah" when they search the exact name.

---

#### ISSUE: Build main chat endpoint

**Type:** Feature
**Priority:** Urgent
**Labels:** backend, ai, sprint-2
**Start:** Mar 26 | **Due:** Mar 29
**Estimate:** 4 points

**Description:**
Create the `POST /api/chat` route using `streamText()` with tools for searching the context library. The agent searches context, retrieves relevant items, and generates a cited response streamed to the client.

**Acceptance Criteria:**
- [ ] `streamText()` with `claude-sonnet-4` via AI Gateway
- [ ] `searchContext` tool: executes hybrid search, returns top results
- [ ] `getFullContent` tool: fetches raw_content when summary isn't enough
- [ ] System prompt: answer only from context, always cite sources
- [ ] `maxSteps: 5` for multi-hop reasoning
- [ ] Streams response via `toDataStreamResponse()`
- [ ] Source citations included in response (title, source_type, date)
- [ ] Integration test: "what did we decide about pricing?" returns answer citing the correct fixture item

**Why:**
The chat interface is Layers' primary value demonstration — it's the "magic moment" where a team member asks a natural language question and gets a precise, sourced answer across all their tools. Getting this right early makes internal adoption inevitable.

---

#### ISSUE: Build chat UI with AI Elements

**Type:** Feature
**Priority:** High
**Labels:** frontend, ai, sprint-2
**Start:** Mar 28 | **Due:** Apr 1
**Estimate:** 3 points

**Description:**
Build the chat interface using `useChat` hook and AI Elements components. Show streaming responses, source citations as clickable cards, and tool call indicators while the agent is searching.

**Acceptance Criteria:**
- [ ] `/chat` page with `ChatPanel` component
- [ ] `useChat` hook connected to `POST /api/chat`
- [ ] Streaming text renders progressively
- [ ] Source citation cards below each response (title, source badge, date, link)
- [ ] "Searching context..." indicator while tools execute
- [ ] Message history persists during session
- [ ] Empty state with suggested questions
- [ ] Keyboard shortcut: Enter to send, Shift+Enter for newline

**Why:**
The chat UI is the primary interface most team members will use daily. Using AI Elements' pre-built streaming components means we get production-quality UX (streaming, tool states, citations) without building custom streaming infrastructure.

---

## SPRINT 3 — Inbox + Sessions + Team
**Dates:** April 2–15, 2026
**Success metric:** All 3 Mirror Factory team members actively using Layers daily.

---

### E5 — Inbox

---

#### ISSUE: Build inbox item generation (cron + AI)

**Type:** Feature
**Priority:** Urgent
**Labels:** backend, ai, sprint-3
**Start:** Apr 2 | **Due:** Apr 5
**Estimate:** 4 points

**Description:**
Create the morning digest cron job that generates prioritized inbox items for each team member using `generateObject()`. Runs at 7 AM daily. Analyzes recent context items and overdue action items to produce a ranked inbox.

**Acceptance Criteria:**
- [ ] Vercel Cron at `POST /api/inbox/generate` (7:00 AM)
- [ ] Fetches context items ingested since last run per user
- [ ] Fetches overdue action items from `entities` JSONB
- [ ] `generateObject()` with `Output.array` for batch inbox item generation
- [ ] Prioritization: urgent/high/normal/low based on deadline and type
- [ ] Deduplication: doesn't create duplicate inbox items for same source
- [ ] Integration test: seeded context items → correct inbox items generated

**Why:**
The morning inbox is the hook that creates daily active use. If team members open Layers every morning and see exactly what needs their attention — without having to search for it — the product becomes a daily habit rather than an occasional tool.

---

#### ISSUE: Build inbox UI (landing page)

**Type:** Feature
**Priority:** Urgent
**Labels:** frontend, sprint-3
**Start:** Apr 4 | **Due:** Apr 8
**Estimate:** 3 points

**Description:**
Build the inbox view as the app's landing page (`/`). Show prioritized items with filter by type and source. Each item links back to its source context item. Supports mark as read, acted, dismissed.

**Acceptance Criteria:**
- [ ] `/` (dashboard root) renders `InboxList`
- [ ] Items sorted by priority (urgent first)
- [ ] `InboxItem` card: title, body, priority badge, source badge, time
- [ ] Filter by: type (action_item, decision, mention), priority, source
- [ ] Actions: mark read, mark acted, dismiss
- [ ] Click item → opens source context item detail
- [ ] Badge count in sidebar nav
- [ ] Empty state: "You're all caught up"

**Why:**
Making the inbox the landing page signals its importance and trains the habit of checking Layers first. The inbox is the product's "newspaper front page" — it should be the answer to "where do I start my day?"

---

#### ISSUE: Build pipeline Step 4 — Link (auto-match to sessions)

**Type:** Feature
**Priority:** High
**Labels:** backend, ai, pipeline, sprint-3
**Start:** Apr 3 | **Due:** Apr 6
**Estimate:** 3 points

**Description:**
Implement the final pipeline step that matches new context items to relevant sessions and team members. Creates `SessionContextLink` records and `InboxItem` records for extracted action items.

**Acceptance Criteria:**
- [ ] `generateObject()` matches content to active sessions by name/goal similarity
- [ ] Creates `SessionContextLink` entries for matched sessions
- [ ] Extracted action items → `InboxItem` for the assigned team member
- [ ] Relevance score stored on `SessionContextLink`
- [ ] Items with no session match still appear in global inbox
- [ ] Integration test: meeting transcript with "Q2 launch" → linked to "Q2 Launch" session

**Why:**
Automatic linking is what turns Layers from a search tool into an operating system. Without it, team members have to manually add context to sessions — with it, relevant information flows to the right place automatically, compounding the platform's value over time.

---

### E6 — Sessions & Workspaces

---

#### ISSUE: Build session CRUD and workspace UI

**Type:** Feature
**Priority:** High
**Labels:** frontend, backend, sprint-3
**Start:** Apr 5 | **Due:** Apr 10
**Estimate:** 4 points

**Description:**
Build session creation, management, and the workspace UI. Each session is a scoped container with its own chat interface that only queries context linked to that session.

**Acceptance Criteria:**
- [ ] `/sessions` list page with active sessions
- [ ] `CreateSessionDialog`: name + goal fields
- [ ] `POST /api/sessions` creates session
- [ ] `/sessions/[id]` workspace page
- [ ] Session workspace has: context feed (linked items), scoped chat, session info panel
- [ ] `POST /api/chat/session/[id]` limits search to session-linked context items
- [ ] Manual "Add context" lets users link items to sessions

**Why:**
Sessions are the feature that makes Layers work for project-based teams. Without sessions, everything is in one pile. With sessions, the "Q2 Product Launch" session becomes a live workspace that automatically accumulates all relevant meetings, tasks, and documents — giving everyone on the project instant context.

---

### E7 — Team & Auth

---

#### ISSUE: Team invitations and org management

**Type:** Feature
**Priority:** High
**Labels:** backend, frontend, sprint-3
**Start:** Apr 5 | **Due:** Apr 10
**Estimate:** 3 points

**Description:**
Build team invitation flow so org owners can invite team members via email. New members join the org, inherit RLS access to all org data, and appear in the team roster.

**Acceptance Criteria:**
- [ ] `/settings/team` page shows current org members
- [ ] Invite by email: sends magic link via Supabase Auth
- [ ] On acceptance: creates `org_member` record with `role: member`
- [ ] Owner can change roles (member → admin) and remove members
- [ ] Removed members lose RLS access immediately
- [ ] Integration test: invite → accept → confirm org data is accessible

**Why:**
Layers' value compounds with team size — more members means more context ingested, more action items tracked, more decisions logged. Getting the invitation flow right unblocks the transition from solo use to team use, which is when the platform's network effects kick in.

---

#### ISSUE: Settings page (team, billing, integrations overview)

**Type:** Feature
**Priority:** Normal
**Labels:** frontend, sprint-3
**Start:** Apr 10 | **Due:** Apr 15
**Estimate:** 2 points

**Description:**
Build the settings page with three sections: Team (member management), Billing (credit balance, purchase), and Integrations (connected tools overview and manage).

**Acceptance Criteria:**
- [ ] `/settings` with tabbed navigation
- [ ] Team tab: member list, invite form, role management
- [ ] Billing tab: credit balance, usage history, "Purchase Credits" → Stripe Checkout
- [ ] Integrations tab: connected services summary, quick disconnect
- [ ] All actions update in real-time without page refresh

**Why:**
Settings is the operational foundation that lets the team self-manage the platform without developer intervention. Billing visibility is important for P1 even with internal use — it establishes the credit tracking pattern needed for external customers.

---

## POST-P1 BACKLOG (P2 / P3)
_Not scheduled — captured for future sprints_

- [ ] **Ditto agent personalization** — per-user AI agent that learns preferences
- [ ] **Daily digest email** — morning inbox delivered to email
- [ ] **Session agent auto-monitoring** — agents poll for new relevant context
- [ ] **Discord integration** — real-time message ingestion
- [ ] **Granola official API migration** — replace daemon with enterprise API
- [ ] **Self-service signup + onboarding** — for external customers
- [ ] **Agent specialization templates** — sales call analyzer, sprint retrospective summarizer
- [ ] **Canvas UI (Easel)** — visual workspace with React Three Fiber
- [ ] **Playwright E2E test suite** — full user journey tests

---

## Labels Reference

| Label | Description |
|-------|-------------|
| `infrastructure` | Dev environment, CI, tooling |
| `backend` | API routes, server logic |
| `frontend` | UI components, pages |
| `ai` | AI SDK calls, prompts, evals |
| `pipeline` | Context ingestion and processing |
| `integrations` | External service connections |
| `database` | Schema, migrations, queries |
| `testing` | Tests, evals, QA |
| `auth` | Authentication and authorization |
| `search` | Hybrid search and retrieval |
| `sprint-1` | Sprint 1 (Mar 5–18) |
| `sprint-2` | Sprint 2 (Mar 19–Apr 1) |
| `sprint-3` | Sprint 3 (Apr 2–15) |

---

## Priority Reference

| Priority | Criteria |
|----------|----------|
| Urgent | Blocks other sprint work |
| High | Core to sprint success metric |
| Normal | Important but not blocking |
| Low | Nice to have this sprint |
