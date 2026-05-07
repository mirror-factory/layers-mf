# Granger -- Architecture Overview

> How Granger works: system design, data flow, credential scoping, and cost model.

---

## System Overview

```
+-------------------------------------------------------------+
|                     GRANGER SYSTEM                          |
+-------------------------------------------------------------+
|                                                             |
|  +----------+    +----------+    +--------------------+     |
|  |  Web UI  |    | Discord  |    |   Cron Jobs        |     |
|  | (Next.js)|    |   Bot    |    | (Vercel Crons)     |     |
|  |          |    |          |    |                    |     |
|  | /chat    |    | /ask     |    | 7AM  Digest        |     |
|  | /approve |    | /status  |    | 2h   Alerts        |     |
|  | /settings|    | /tasks   |    | 15m  Granola poll  |     |
|  |          |    | DMs      |    | 2AM  Synthesis     |     |
|  +----+-----+    +----+-----+    +--------+-----------+     |
|       |               |                   |                 |
|       +---------------+-------------------+                 |
|                       |                                     |
|              +--------v--------+                            |
|              |  AGENT CORE     |                            |
|              |                 |                            |
|              | Priority Docs   | <- Always in system prompt |
|              | ToolLoopAgent   | <- AI SDK v6               |
|              | 13 Tools        | <- 80% zero-token cost     |
|              | Approval Queue  | <- Human-in-the-loop       |
|              | Compaction      | <- Claude Code-style memory|
|              +--------+--------+                            |
|                       |                                     |
|       +---------------+-------------------+                 |
|       |               |                   |                 |
|  +----v-----+   +-----v------+   +-------v------+          |
|  | Direct   |   | Supabase   |   | AI Gateway   |          |
|  | APIs     |   |            |   |              |          |
|  |          |   | PostgreSQL |   | Claude       |          |
|  | Granola  |   | pgvector   |   | GPT          |          |
|  | Linear   |   | pg_trgm    |   | Gemini       |          |
|  | Discord  |   | RLS        |   |              |          |
|  | Notion   |   | Auth       |   | 9 models     |          |
|  | Gmail    |   |            |   | 3 tiers      |          |
|  | Drive    |   |            |   |              |          |
|  |          |   |            |   | Single key   |          |
|  | $0/call  |   |            |   |              |          |
|  +----------+   +------------+   +--------------+          |
|                                                             |
+-------------------------------------------------------------+
```

Granger is Mirror Factory's conversational chief of staff. It is a persistent AI agent -- not a dashboard with AI features. It loops like Claude Code: reasons, proposes, waits for approval, executes, verifies.

Three entry points (Web UI, Discord bot, cron jobs) feed into the same agent core with the same priority docs, tools, and context library. External services are called via direct APIs at zero token cost. The LLM is only invoked for intelligence (extraction, synthesis, chat).

---

## Core Architecture Principles

1. **Direct APIs for CRUD, LLM only for intelligence.** ~80% of operations cost zero AI tokens. Querying Linear, searching Gmail, reading Granola transcripts -- all direct API calls.

2. **Priority documents override everything.** 5 markdown files in `/docs/priority/` are always loaded into the system prompt. Company values take precedence over any ingested content.

3. **Human-in-the-loop by default.** All write actions go through the approval queue. Partners approve or reject via the web UI or Discord reactions.

4. **Model-agnostic via AI Gateway.** One API key, 9 models, 3 providers, 3 tiers. Model swaps are a string change.

5. **Multi-channel, single brain.** Web, Discord DMs, and Discord channels all talk to the same agent with the same knowledge. Conversations are separate streams but share the same context library.

---

## Request Flow

### Chat Request (Web UI)

```
User types message in /chat
  |
  v
POST /api/chat
  |
  v
Load priority docs from /docs/priority/*.md
  |
  v
Load compacted conversation summary (if resuming)
  |
  v
ToolLoopAgent runs (up to 10 steps):
  |
  +---> Tool: search_context     -> Supabase hybrid search ($0)
  +---> Tool: query_linear       -> Linear GraphQL API ($0)
  +---> Tool: search_gmail       -> Gmail REST API ($0)
  +---> Tool: query_granola      -> Granola REST API ($0)
  +---> Tool: search_notion      -> Notion REST API ($0)
  +---> Tool: propose_action     -> Insert into approval_queue ($0)
  +---> LLM reasoning            -> AI Gateway (~$0.01-0.03)
  |
  v
createAgentUIStreamResponse -> streams to client
  |
  v
onStepFinish / onFinish -> log to agent_runs table
```

### Discord Interaction

```
Partner types "@Granger what happened in our last meeting?" in #general
  |
  v
Discord POST -> /api/discord/interactions
  |
  v
Verify signature (Ed25519 with DISCORD_PUBLIC_KEY)
  |
  v
Identify partner (Discord user ID -> Supabase user via credentials)
  |
  v
Same ToolLoopAgent pipeline as web chat
  |
  v
Bot responds in a Discord thread
  |
  v
Message + response stored in chat_messages (channel='discord')
```

### Cron: Morning Digest (7 AM weekdays)

```
Vercel Cron -> POST /api/cron/digest
  |
  v
For each partner:
  +---> Query Linear: overdue issues, upcoming due dates ($0)
  +---> Query Granola: today's meetings ($0)
  +---> Query context library: recent decisions, open items ($0)
  +---> Generate personalized digest via Sonnet 4.6 (~$0.02)
  |
  v
Post to #granger-digest via Discord Bot API ($0)
```

### Cron: Ingestion (every 15 min)

```
Vercel Cron -> POST /api/cron/ingest
  |
  v
Poll Granola API: GET /v1/notes?created_after=<last_check> ($0)
  |
  v
For each new meeting:
  +---> Fetch full transcript ($0)
  +---> Extract decisions, action items, key points via LLM (~$0.01/doc)
  +---> Generate embedding via text-embedding-3-small (~$0.0001/doc)
  +---> Store in context_items table ($0)
  +---> Post summary to #granger-alerts ($0)
  +---> Check extractions against priority docs for conflicts
```

### Cron: Nightly Synthesis (2 AM)

```
Vercel Cron -> POST /api/cron/synthesis
  |
  v
Load 30 days of context items from Supabase ($0)
  |
  v
Opus 4.6 reviews for cross-source patterns (~$0.10-0.50):
  - Recurring topics across meetings
  - Decisions not yet acted on
  - Stalled tasks mentioned in multiple sources
  - Conflicts between meeting decisions and priority docs
  |
  v
Store synthesis results in context_items ($0)
```

---

## Credential Scoping

```
+---------------------------------------------------------+
|                   CREDENTIALS TABLE                      |
+---------------------------------------------------------+
|                                                         |
|  ORG-LEVEL (user_id = NULL)                             |
|  +-------------------------------------------------+    |
|  | Discord Bot Token    -> shared bot               |    |
|  | Granola API Key      -> all team meetings        |    |
|  | Notion Integration   -> shared workspace         |    |
|  +-------------------------------------------------+    |
|                                                         |
|  USER-LEVEL (user_id = partner's ID)                    |
|  +-------------------------------------------------+    |
|  | Alfonso's Gmail      -> only Alfonso's email     |    |
|  | Alfonso's Drive      -> only Alfonso's files     |    |
|  | Kyle's Gmail         -> only Kyle's email        |    |
|  | Kyle's Drive         -> only Kyle's files        |    |
|  | Bobby's Gmail        -> only Bobby's email       |    |
|  | Bobby's Drive        -> only Bobby's files       |    |
|  | Each partner's       -> personal AI billing      |    |
|  |   AI Gateway key       (optional)                |    |
|  +-------------------------------------------------+    |
|                                                         |
+---------------------------------------------------------+
```

The `credentials` table stores all API keys and OAuth tokens. The `user_id` column determines scope:

- **NULL** = org-level credential, shared by all partners (Discord bot, Granola, Notion)
- **Set** = user-level credential, only used when that partner makes requests (Gmail, Drive, personal AI key)

Row-level security ensures partners only see their own credentials. Org-level credentials are visible to all org members.

**Token refresh**: Only Gmail and Drive use OAuth 2.0 with refresh tokens. All other services use static API keys that never expire.

---

## Multi-Channel Communication

```
Same Agent Brain, Different Doors
====================================

Web UI (personal)           Discord Channel (team)
+------------------+        +------------------+
| Alfonso chats    |        | #general         |
| with Granger     |        | @Granger what    |
|                  |        | happened in our  |
| Only Alfonso     |        | last meeting?    |
| sees this        |        |                  |
|                  |        | Everyone sees    |
| Stored:          |        | this             |
| user_id=alfonso  |        |                  |
| channel=web      |        | Stored:          |
+------------------+        | channel=discord  |
                            | discord_channel= |
Discord DM (personal)       | #general-id      |
+------------------+        +------------------+
| Bobby DMs        |
| @Granger         |        All three channels use:
|                  |         * Same priority docs
| Only Bobby sees  |         * Same tools
| this             |         * Same context library
|                  |         * Same approval queue
| Stored:          |
| user_id=bobby    |        Different:
| channel=discord  |         x Conversation history
+------------------+         x Personal credentials
```

Conversations are separate streams but share the same brain. When a partner says "continue what we were working on," Granger searches recent conversations across channels and resumes from the compacted summary.

---

## Approval Flow

```
User: "Create a task for the auth refactor"
  |
  v
Granger (ToolLoopAgent) decides to create Linear issue
  |
  v
Calls create_linear_issue tool
  |
  v
Tool inserts into approval_queue (NOT directly to Linear)
  |
  +--- Web UI: Shows ApprovalCard with [Approve] / [Reject]
  |
  +--- Discord: Posts proposal with reaction buttons
       |
       v
  Partner approves (clicks button or reacts with checkmark)
       |
       v
  POST /api/approval/[id] -> status = 'approved'
       |
       v
  System executes: Linear GraphQL API -> issue created ($0)
```

### Approval Tiers

| Action Type | Examples | Phase 1 (Strict) | Future (Loose) |
|-------------|----------|-------------------|----------------|
| Read / Search | Query Linear, search Gmail | Auto-approve | Auto-approve |
| Create (low risk) | Create Linear issue, draft email | Propose + wait | Auto-approve |
| Create (high risk) | Send email, post in Slack | Propose + wait | Propose + wait |
| Update / Delete | Change status, reassign task | Propose + wait | Configurable |

### Values-Based Reasoning

Before proposing any action, Granger checks it against priority documents:

1. Meeting transcript says: "Cut the testing phase to ship faster"
2. Priority doc `01-mission.md` says: "We don't ship without tests"
3. Granger flags the conflict instead of blindly executing
4. Proposes alternatives and asks the partner for guidance

---

## Context Window Composition

The system prompt is assembled in strict priority order:

```
+-------------------------------------------------------+
| 1. Priority Docs (highest weight, always loaded)      |
|    01-mission.md  - Mission, vision, core values      |
|    02-team.md     - Partner roles, preferences        |
|    03-priorities.md - Current quarter priorities       |
|    04-clients.md  - Active client rules               |
|    05-agent.md    - Granger's personality, rules      |
+-------------------------------------------------------+
| 2. Compacted History (if resuming conversation)       |
|    ~500-token summary of older messages               |
|    Preserves: decisions, open items, preferences      |
+-------------------------------------------------------+
| 3. Agent Instructions                                 |
|    Tool definitions, approval rules, personality      |
+-------------------------------------------------------+
| 4. Recent Messages (last ~20)                         |
|    Current conversation context                       |
+-------------------------------------------------------+
| 5. Tool Results (injected during conversation)        |
|    Search results, API responses, etc.                |
+-------------------------------------------------------+
```

Ingested content (meetings, emails, docs) is NOT in the system prompt. It is retrieved on-demand via the `search_context` tool using hybrid search (pgvector + pg_trgm with RRF scoring).

### Compaction

When a conversation exceeds ~80% of the context window, older messages are summarized into a ~500-token compacted summary using a cheap model (Haiku). The summary preserves key decisions, open action items, unresolved questions, and partner preferences.

---

## Model Routing Strategy

Single API key, 9 models, 3 providers, 3 tiers. Each task uses the most cost-effective model.

### Task-to-Model Mapping

| Task | Primary Model | Tier | Est. Cost |
|------|--------------|------|-----------|
| Ingestion / classification | `anthropic/claude-haiku-4.5` | Fast | ~$0.001/doc |
| Extraction (structured) | `anthropic/claude-sonnet-4.6` | Balanced | ~$0.01/doc |
| Chat (user-facing) | User-selected (9 models) | Varies | ~$0.01-0.03 |
| Digest generation | `anthropic/claude-sonnet-4.6` | Balanced | ~$0.02/digest |
| History compaction | `anthropic/claude-haiku-4.5` | Fast | ~$0.001 |
| Nightly synthesis | `anthropic/claude-opus-4.6` | Flagship | ~$0.10/run |
| Embeddings | `openai/text-embedding-3-small` | -- | ~$0.0001/doc |

### Full Model Matrix

| Tier | Claude | OpenAI | Gemini |
|------|--------|--------|--------|
| Flagship | `claude-opus-4.6` | `gpt-5.4` | `gemini-3-pro` |
| Balanced | `claude-sonnet-4.6` | `gpt-5.4-mini` | `gemini-3-flash` |
| Fast | `claude-haiku-4.5` | `gpt-5-nano` | `gemini-2.5-flash-lite` |

### Per-Partner Keys

Each partner can add their own AI Gateway key for separate billing. If not set, requests fall back to the shared team key:

```
Partner makes request
  |
  v
Check credentials table for user-level AI Gateway key
  |
  +-- Found? -> Use partner's key (billed to them)
  |
  +-- Not found? -> Use AI_GATEWAY_API_KEY env var (shared billing)
```

---

## Data Sources

All external services are accessed via direct REST/GraphQL APIs. No MCP, no Nango dependency for new integrations.

| Source | API | Auth | Refresh? | Cost per call |
|--------|-----|------|----------|---------------|
| Granola | `public-api.granola.ai/v1/` | Bearer `grn_` key | No | $0 |
| Linear | `api.linear.app/graphql` | Bearer personal key | No | $0 |
| Discord | `discord.com/api/v10/` | Bot token | No | $0 |
| Notion | `api.notion.com/v1/` | Bearer `secret_` token | No | $0 |
| Gmail | `gmail.googleapis.com/gmail/v1/` | OAuth 2.0 | Yes (~1hr) | $0 |
| Google Drive | `googleapis.com/drive/v3/` | OAuth 2.0 (shared) | Yes (~1hr) | $0 |

Gmail and Drive share the same OAuth credentials. One consent flow covers both services.

---

## Database Schema (Key Tables)

| Table | Purpose | Scope |
|-------|---------|-------|
| `conversations` | Chat conversation metadata | Per-user or per-channel |
| `chat_messages` | Full message history (text, tool calls, results) | Per-conversation |
| `context_items` | Ingested knowledge with embeddings (400+ docs) | Per-org |
| `priority_documents` | Always-in-context docs (mission, values, etc.) | Per-org |
| `credentials` | Encrypted API keys and OAuth tokens | Per-org or per-user |
| `approval_queue` | Pending/approved/rejected agent actions | Per-org |
| `organizations` | Org metadata | -- |
| `org_members` | User-to-org mapping with roles | -- |
| `agent_runs` | Agent execution logs (steps, tokens, cost) | Per-conversation |

All tables use row-level security (RLS) scoped by organization via `org_members`.

---

## Cron Jobs

Defined in `vercel.json`, running on Vercel's cron infrastructure:

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| Weekdays 7 AM | `/api/cron/digest` | Personalized morning briefing per partner |
| Every 2 hours | `/api/cron/discord-alerts` | Overdue items, conflicts, pattern alerts |
| Every 15 min | `/api/cron/ingest` | Poll Granola for new meetings, process and store |
| Daily 2 AM | `/api/cron/synthesis` | Cross-source pattern analysis (Opus 4.6) |
| Daily 7 AM | `/api/inbox/generate` | Generate inbox items from recent activity |
| Monthly 1st | `/api/cron/credit-reset` | Reset monthly usage credits |
| Every 20 hours | `/api/cron/drive-watch-renewal` | Renew Google Drive push notification channels |

---

## Cost Model

```
Daily Operations for 3 Partners
=================================

ZERO COST (Direct API calls):
+-- Linear queries          $0.00
+-- Gmail searches          $0.00
+-- Granola lookups         $0.00
+-- Notion searches         $0.00
+-- Drive file listing      $0.00
+-- Discord messages        $0.00
+-- Supabase queries        $0.00

AI COST (Gateway only):
+-- Chat (per question)     ~$0.01-0.03
+-- Extraction (per doc)    ~$0.01
+-- Digest (per partner)    ~$0.02
+-- Compaction              ~$0.001
+-- Nightly synthesis       ~$0.10-0.50

===================================
Total daily:   ~$1.50-2.50 for 3 partners
Total monthly: ~$30-60
```

The key insight: every API call to Linear, Gmail, Granola, Notion, Discord, and Drive costs $0. The LLM is only invoked for intelligence -- extraction, synthesis, and chat responses. This keeps costs an order of magnitude lower than architectures that route everything through the LLM.

---

## Key File Locations

### Agent Core

| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | ToolLoopAgent + createAgentUIStreamResponse |
| `src/lib/ai/config.ts` | AI Gateway setup, model definitions, `getGateway()` |
| `src/lib/ai/tools.ts` | Tool definitions (13 tools) |
| `src/lib/ai/priority-docs.ts` | Load `/docs/priority/*.md` into system prompt |
| `src/lib/ai/compact.ts` | Conversation history compaction |
| `src/lib/ai/extract.ts` | Structured extraction with Zod schemas |
| `src/lib/ai/embed.ts` | 1536-dim embeddings via AI Gateway |

### Priority Documents

| File | Contents |
|------|----------|
| `docs/priority/01-mission.md` | Mission, vision, core values (highest weight) |
| `docs/priority/02-team.md` | Partner roles, preferences, working styles |
| `docs/priority/03-priorities.md` | Current quarter priorities |
| `docs/priority/04-clients.md` | Active client rules and contacts |
| `docs/priority/05-agent.md` | Granger's personality and behavior rules |

### Cron Jobs

| File | Schedule |
|------|----------|
| `src/app/api/cron/digest/route.ts` | Weekdays 7 AM |
| `src/app/api/cron/discord-alerts/route.ts` | Every 2 hours |
| `src/app/api/cron/ingest/route.ts` | Every 15 min |
| `src/app/api/cron/synthesis/route.ts` | Daily 2 AM |
| `src/app/api/cron/credit-reset/route.ts` | Monthly |
| `src/app/api/cron/drive-watch-renewal/route.ts` | Every 20 hours |

### Discord

| File | Purpose |
|------|---------|
| `src/app/api/discord/interactions/route.ts` | Slash commands + @mention handler |
| `scripts/register-discord-commands.ts` | One-time command registration |

### Web UI

| File | Purpose |
|------|---------|
| `src/components/chat-interface.tsx` | Chat UI with useChat + tool rendering |
| `src/app/settings/` | API key management, partner preferences |

### Database

| Location | Purpose |
|----------|---------|
| `supabase/migrations/` | All schema migrations (13+) |
| `src/lib/database.types.ts` | Auto-generated TypeScript types |
