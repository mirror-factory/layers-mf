# GRANGER — Development Specification

> **Read this document completely before starting any work.**
> Builder: Alfonso with Claude Code | Timeline: 2–3 weeks | Base: Layers 2026.1 codebase

---

## 1. What We're Building

Granger is Mirror Factory's conversational chief of staff — an autonomous AI agent that connects to every tool the team uses, extracts structured knowledge from meetings and messages, maintains company values as guardrails, and takes action with partner approval. It communicates through a web UI and a Discord bot.

Granger is **NOT** a dashboard with AI features. It's a persistent conversational agent that loops like Claude Code — state management, history compaction, session persistence, and a compressed context directory where priority documents are always in the system prompt.

### Key Characteristics

- **Conversational loop like Claude Code** — not request/response. Granger loops, reasons, proposes, waits for approval, executes, verifies.
- **Model-agnostic via Vercel AI Gateway** — Claude, OpenAI, and Gemini at three tiers. Single API key. Model swaps are a string change.
- **Direct API integrations (NOT MCP)** — all CRUD and lookups are zero-token-cost API calls. LLM only fires for intelligence (extraction, synthesis, chat).
- **Priority document hierarchy** — 5–10 core docs always loaded in the system prompt. These OVERRIDE ingested content. Company values > meeting decisions.
- **Approval workflow** — all write actions require partner approval initially. Reads and searches auto-approve. Trust loosens over time.
- **Multi-channel** — web UI + Discord bot. Same agent, same context, different interfaces.
- **Per-partner API keys** — each partner can optionally add their own AI Gateway key, with fallback to the shared team key.

### Multi-User Architecture (3 Partners)

One Supabase database. One org (Mirror Factory). Three user accounts (Alfonso, Kyle, Bobby). Each signs in with Google Auth (already built in Layers). The existing `organizations` + `org_members` tables with RLS handle this.

**What's shared vs. personal:**

| What | Scope | Who sees it |
|---|---|---|
| Priority docs (mission, values, priorities) | Org-level | All 3 partners |
| Context library (meetings, extractions, docs) | Org-level | All 3 partners |
| Approval queue (pending actions) | Org-level | All 3 partners can approve/reject |
| API credentials (Granola key, Discord bot token) | Org-level (shared keys) | Managed by admin |
| API credentials (personal Gmail OAuth, Linear key) | User-level | Only that partner |
| AI Gateway key | User-level (optional, falls back to shared) | Only that partner |
| Web chat conversations | User-level | Only that partner (private by default) |
| Discord channel conversations | Channel-level | Everyone in the Discord channel |
| Discord DM conversations | User-level | Only that partner + Granger |
| Morning digests | Personalized per user | Each partner sees their own overdue items, assigned tasks |

### Multi-Channel Communication Model

Discord and web conversations are NOT the same conversation — they're **the same agent accessible through different doors.** Granger always has the same priority docs, same context library, same tools. The conversations themselves are separate streams.

- **Web UI**: Alfonso chats with Granger → personal conversation stored with his `user_id`
- **Discord DM**: Alfonso DMs @Granger → separate conversation, but same brain. Granger can search Alfonso's web conversations if asked to "continue what we were working on"
- **Discord channel**: Alfonso @mentions @Granger in #general → team conversation, all 3 partners see it, responses are threaded
- **Cross-channel continuity**: Say "@Granger, continue what I was working on about the pricing model" → Granger searches recent conversations, finds the relevant one, loads the compacted summary, picks up from there. Intelligent lookup, not automatic seamless continuation.

Think of it like messaging a colleague: you can DM them AND talk to them in a group channel. Different conversations, same person, same knowledge.

### Default Tech Stack

- **Vercel AI SDK v6** — ToolLoopAgent, generateObject, embed, useChat, createAgentUIStreamResponse
- **Vercel AI Gateway** — single API key routes to Claude, OpenAI, Gemini. All models accessible via `gateway("provider/model")`
- **AI Elements (shadcn/ui for AI)** — 50+ pre-built components: Message, Tool, Sources, Queue, Task, Reasoning, PromptInput
- **Supabase** — PostgreSQL + pgvector + pg_trgm + Auth + Edge Functions + Realtime + RLS
- **Discord.js v14** — full bot with slash commands and autonomous posting
- **Next.js 16** — App Router, React 19, TypeScript
- **Zod 4** — schema validation for structured outputs
- **pnpm** — package manager

---

## 2. Existing Infrastructure (Layers 2026.1)

Granger evolves from the Layers 2026.1 codebase. **Same repo, new direction. DO NOT start from scratch.** The following already exists and is directly reusable:

### Already Built

| Component | What Exists | File |
|---|---|---|
| ToolLoopAgent | Autonomous 6-step agent loop with tool calling | `src/app/api/chat/route.ts` |
| createAgentUIStreamResponse | Streams tool states + text to client | `src/app/api/chat/route.ts` |
| generateObject() | Structured extraction with Zod schemas | `src/lib/ai/extract.ts` |
| embed() | 1536-dim embeddings via AI Gateway | `src/lib/ai/embed.ts` |
| gateway() | Single key routes to all providers | `src/lib/ai/config.ts` |
| useChat() | Client-side streaming + tool rendering | `src/components/chat-interface.tsx` |
| Hybrid search (RRF) | pgvector + pg_trgm, k=60, HNSW index | Supabase RPC function |
| Inbox generation | Output.array() for typed inbox items | `src/lib/inbox/generate.ts` |
| Nango integrations | GitHub, Drive, Linear, Discord, Slack, Granola | `src/lib/integrations/` |
| Processing pipeline | Fetch → extract → embed → store → inbox | Per-provider sync handlers |
| RLS multi-tenancy | Org-scoped row-level security on all tables | 13 Supabase migrations |
| Eval harnesses | Retrieval quality, context health, agent quality | Test suite |
| 7 models configured | Haiku, Sonnet, Opus, GPT-4o, GPT-4o-mini, Gemini Flash, Pro | `src/lib/ai/config.ts` |
| Stripe payments | Payment integration | Stripe setup |
| Auth | Google auth + Supabase auth | Auth middleware |
| Conversations + chat_messages | Full conversation persistence tables | Supabase schema |
| context_items | 400+ ingested documents with embeddings | Supabase schema |
| Sessions | Scoped workspaces with their own context and agent | `src/app/sessions/` |
| Analytics | Usage KPIs, token tracking, sync history | `src/app/analytics/` |
| onStepFinish / onFinish | Per-step analytics and agent_runs logging | `src/app/api/chat/route.ts` |

### Model Strings to Update

The model config in `src/lib/ai/config.ts` is stale. Update to current AI Gateway models:

| Old String | New String | Tier |
|---|---|---|
| `anthropic/claude-haiku-4-5-20251001` | `anthropic/claude-haiku-4.5` | Fast/cheap |
| `anthropic/claude-sonnet-4.5` | `anthropic/claude-sonnet-4.6` | Balanced |
| `anthropic/claude-opus-4.6` | Keep (already current) | Flagship |
| `openai/gpt-4o-mini` | `openai/gpt-5.4-mini` | Balanced |
| `openai/gpt-4o` | `openai/gpt-5.4` | Flagship |
| `google/gemini-flash` | `google/gemini-3-flash` | Balanced |
| `google/gemini-pro` | `google/gemini-3-pro` | Flagship |
| (add new) | `openai/gpt-5-nano` | Fast/cheap |
| (add new) | `google/gemini-2.5-flash-lite` | Fast/cheap |

### Full Model Matrix (9 models across 3 providers × 3 tiers)

| Tier | Claude | OpenAI | Gemini | Use Case |
|---|---|---|---|---|
| Flagship | `anthropic/claude-opus-4.6` | `openai/gpt-5.4` | `google/gemini-3-pro` | Synthesis, deep reasoning, complex analysis |
| Balanced | `anthropic/claude-sonnet-4.6` | `openai/gpt-5.4-mini` | `google/gemini-3-flash` | Chat, extraction, general work |
| Fast/cheap | `anthropic/claude-haiku-4.5` | `openai/gpt-5-nano` | `google/gemini-2.5-flash-lite` | Ingestion, classification, task creation |

---

## 3. Data Sources — All Direct API (No MCP, No Nango)

Replace Nango with direct API integrations. Each source uses its own REST/GraphQL API with OAuth tokens stored in Supabase. This gives full control, zero vendor dependency, and zero token cost for lookups.

### Day-One Sources (Verified API Details)

| Source | Base URL | Auth Method | Token Type | Refresh? | NPM Package |
|---|---|---|---|---|---|
| Granola | `https://public-api.granola.ai/v1/` | Bearer token | `grn_` personal API key (Business plan+) | No | None (fetch) |
| Linear | `https://api.linear.app/graphql` | Bearer token | Personal API key | No | `@linear/sdk` |
| Discord | `https://discord.com/api/v10/` | Bot token | Bot token from Developer Portal | No | `discord.js` v14 |
| Notion | `https://api.notion.com/v1/` | Bearer token | Internal integration token (`secret_`) + `Notion-Version: 2026-03-11` header | No | `@notionhq/client` |
| Gmail | `https://gmail.googleapis.com/gmail/v1/` | OAuth 2.0 Bearer | Google access token | **Yes** — refresh every ~1hr | `googleapis` |
| Google Drive | `https://www.googleapis.com/drive/v3/` | OAuth 2.0 Bearer (shared with Gmail) | Same Google access token | **Yes** — same refresh | `googleapis` |

**Only Gmail + Drive need OAuth refresh flows.** Everything else is a static key stored in the `credentials` table. This dramatically simplifies the auth layer — 4 of 6 sources are just "store a key, attach it as Bearer token."

### Granola API Specifics (Confirmed March 2026)

Granola just launched their public personal API on Business plans. Key endpoints:
- `GET /v1/notes` — list notes with pagination (`?created_after=`, `?cursor=`)
- `GET /v1/notes/{id}` — get a single note
- `GET /v1/notes/{id}?include=transcript` — get note WITH full transcript
- Note IDs use `not_` prefix (e.g., `not_1d3tmYTlCICgjy`), not UUIDs
- Only returns notes with generated AI summary + transcript (still-processing notes are excluded)
- Auth: `Authorization: Bearer grn_YOUR_API_KEY`

### Notion API Specifics

- Create an internal integration at notion.so/my-integrations
- Share specific pages/databases with the integration (required — without this, you get 404s)
- `POST /v1/search` — find all pages/databases shared with integration
- `POST /v1/databases/{id}/query` — query a database with filters and sorts
- `GET /v1/pages/{id}` — get a page
- `GET /v1/blocks/{id}/children` — get page content (block-based, not raw text)
- Content is block-based (paragraphs, headings, lists, etc.) — you'll need to flatten blocks to text for extraction
- Header required: `Notion-Version: 2026-03-11`

### Linear GraphQL API Specifics

- Personal API key from Linear settings (no OAuth needed for internal use)
- Single endpoint: `POST https://api.linear.app/graphql`
- Use `@linear/sdk` npm package for typed queries
- Key queries: `issues(filter: {...})`, `issue(id: "...")`, `createIssue(input: {...})`, `updateIssue(id: "...", input: {...})`
- Supports filtering by state, assignee, team, project, priority, due date

### Gmail + Drive OAuth Setup

- Create a Google Cloud project with Gmail API + Drive API enabled
- Create OAuth 2.0 credentials (web application type)
- Redirect URI: `https://your-app.vercel.app/api/auth/google/callback`
- Scopes needed: `gmail.readonly`, `gmail.compose`, `gmail.modify`, `drive.readonly`
- Store refresh_token in `credentials` table (encrypted)
- Access tokens expire in ~1 hour — refresh automatically before API calls
- **Alfonso, Kyle, and Bobby each complete their own OAuth flow** (personal Gmail access)

### The Architecture Rule

> **APIs for ALL CRUD and lookups = zero token cost. LLM via AI Gateway ONLY for intelligence = extraction, synthesis, chat. ~80% of Granger's operations cost zero AI tokens.**

Examples:
- "Show me in-progress Linear issues" = GraphQL query to Linear API. No LLM. **$0.00**.
- "What decisions were made about pricing in our last 3 meetings?" = Supabase semantic search + LLM reasoning. **$0.01–$0.03**.
- "Create a Linear issue for the auth refactor" = LLM decides params → direct Linear API call to create. **~$0.002 for the LLM decision, $0.00 for the API call**.

### Nango Migration Plan

The existing Nango integration handlers in `src/lib/integrations/` should be replaced one by one:

1. Create `src/lib/api/` directory with one file per source: `granola.ts`, `linear.ts`, `discord.ts`, `notion.ts`, `gmail.ts`, `drive.ts`
2. Each file exports typed functions: `list()`, `get()`, `create()`, `update()`, `search()` as applicable
3. OAuth tokens stored in a new `credentials` table in Supabase (encrypted via Supabase Vault or pgcrypto)
4. Token refresh logic per provider:
   - **Granola**: Static API key (no refresh needed)
   - **Linear**: Personal API key (no refresh needed)
   - **Discord**: Bot token (no refresh needed)
   - **Notion**: Internal integration token (no refresh needed)
   - **Gmail + Drive**: Google OAuth 2.0 with refresh token flow (shared auth)
5. The existing processing pipeline (fetch → extract → embed → store → inbox) stays unchanged — just swap the data source from Nango proxy to direct API calls
6. Remove Nango package and all Nango-specific code after migration is complete

---

## 4. Priority Document System

This is the most important architectural feature of Granger. It's the equivalent of `CLAUDE.md` in Claude Code — a set of always-in-context documents that define who Granger is, what Mirror Factory values, and how to make decisions.

### How It Works

1. 5–10 markdown files live in the repo under `/docs/priority/` (git-versioned, deployed with the app)
2. These files are ALSO synced to Supabase on deploy so the web UI can display and eventually edit them
3. At request time, all priority docs are loaded and concatenated into the system prompt BEFORE any ingested context
4. The agent's `instructions` field in ToolLoopAgent receives: `priority docs + agent.md instructions + tool definitions`
5. **Priority docs OVERRIDE ingested content.** If a meeting transcript says "cut corners to save money" but a priority doc says "quality over speed," Granger flags the conflict instead of executing blindly.

### Initial Priority Documents (5 files)

| File | Contents |
|---|---|
| `01-mission.md` | Mirror Factory's mission, vision, and core values. What we believe. What we won't compromise on. **Highest-weight document.** |
| `02-team.md` | Who's on the team (Alfonso, Kyle, Bobby), their roles, communication preferences, working styles. How Granger should address each person. |
| `03-priorities.md` | Current quarter priorities. What projects matter most. What we're saying no to. Updated quarterly. |
| `04-clients.md` | Active client rules. ROI Amplified client list with service tiers. Key contacts. What each client expects. |
| `05-agent.md` | Granger's own instructions. Personality, communication style, approval rules, what to flag, what to auto-approve. The CLAUDE.md equivalent. |

### Implementation

```typescript
// src/lib/ai/priority-docs.ts
import fs from 'fs/promises';
import path from 'path';

const PRIORITY_DIR = path.join(process.cwd(), 'docs', 'priority');

export async function loadPriorityDocs(): Promise<string> {
  const files = await fs.readdir(PRIORITY_DIR);
  const mds = files.filter(f => f.endsWith('.md')).sort();
  const contents = await Promise.all(
    mds.map(async f => {
      const text = await fs.readFile(path.join(PRIORITY_DIR, f), 'utf-8');
      return `## ${f.replace('.md', '')}\n${text}`;
    })
  );
  return contents.join('\n\n---\n\n');
}
```

Then in the chat route:

```typescript
// src/app/api/chat/route.ts
const priorityDocs = await loadPriorityDocs();
const agent = new ToolLoopAgent({
  model: gateway(selectedModel),
  instructions: `${priorityDocs}\n\n${agentInstructions}`,
  tools: { ...tools },
  stepCountIs: 10, // increased from 6 for longer reasoning chains
});
```

### Context Loading Order (system prompt composition)

```
1. Priority docs (01-mission through 05-agent) — ALWAYS loaded, highest weight
2. Compacted conversation summary (if resuming a conversation)
3. Agent instructions (tool definitions, approval rules, personality)
4. Recent messages (last ~20 messages from current conversation)
5. Tool results (injected as conversation progresses)
```

Ingested content from meetings, Slack, etc. is NOT in the system prompt. It's retrieved via the `search_context` tool when the agent needs it. This keeps the context window focused on what matters most.

---

## 5. Conversation Loop — Like Claude Code

Granger's conversation style is a persistent loop, not request/response. It maintains full history in the database for search, plus a compacted summary in the context window for the active conversation.

### State Management

- Full message history stored in `chat_messages` table (existing) — every message, every tool call, every result
- Active conversation context window gets a compacted summary of older messages to stay within token limits
- **Compaction trigger**: when conversation exceeds ~80% of context window, summarize older messages into a ~500-token summary
- The summary preserves: key decisions, open action items, unresolved questions, partner preferences expressed in this session
- New messages see: `priority docs + compacted history + recent messages (last ~20) + tool results`

### Compaction Implementation

```typescript
// src/lib/ai/compact.ts
import { generateText } from 'ai';
import { gateway } from './config';

export async function compactHistory(messages: Message[]): Promise<string> {
  const { text } = await generateText({
    model: gateway('anthropic/claude-haiku-4.5'), // cheap model for summarization
    prompt: `Summarize this conversation history into a concise summary preserving:
- Key decisions made
- Open action items with owners
- Unresolved questions
- Partner preferences or instructions expressed
- Any conflicts flagged with priority documents

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Summary (max 500 tokens):`,
  });
  return text;
}
```

### Approval Workflow

Granger proposes actions and waits for approval before executing writes. This is the core trust-building mechanism.

| Action Type | Examples | Phase 1 (Strict) | Future (Loose) |
|---|---|---|---|
| Read / Search | Query Linear, search Gmail, read Slack | Auto-approve | Auto-approve |
| Create (low risk) | Create Linear issue, draft email | Propose + wait for approval | Auto-approve |
| Create (high risk) | Send Slack message, send email | Propose + wait for approval | Propose + wait |
| Update / Delete | Change issue status, reassign task | Propose + wait for approval | Configurable |

### Approval Flow Implementation

When the agent decides to take a write action:

1. Agent calls `propose_action` tool with the action details
2. Action is stored in `approval_queue` table with status `pending`
3. UI shows the proposal with approve/reject buttons
4. On Discord, Granger posts the proposal and waits for a reaction (✅ approve, ❌ reject)
5. On approval, the agent executes the action via direct API call
6. On rejection, the agent acknowledges and continues the conversation

```typescript
// Tool definition for propose_action
tool({
  name: 'propose_action',
  description: 'Propose a write action for partner approval before executing',
  inputSchema: z.object({
    action_type: z.enum(['create_task', 'send_message', 'draft_email', 'update_task', 'send_slack']),
    target_service: z.enum(['linear', 'clickup', 'slack', 'gmail', 'discord', 'notion']),
    payload: z.record(z.any()), // The full action payload
    reasoning: z.string(), // Why the agent wants to take this action
    conflict_check: z.string().optional(), // Any priority doc conflicts detected
  }),
  execute: async (input) => {
    const item = await db.from('approval_queue').insert({
      org_id: orgId,
      action_type: input.action_type,
      target_service: input.target_service,
      payload: input.payload,
      reasoning: input.reasoning,
      conflict_reason: input.conflict_check,
      status: 'pending',
    });
    return { message: `Action proposed. Waiting for approval. ID: ${item.id}` };
  },
});
```

### Values-Based Reasoning

When Granger proposes an action, it checks the action against priority documents. If there's a conflict, Granger explains the conflict and asks for guidance instead of executing.

**Example flow:**

1. Meeting transcript says: "Let's cut the testing phase to ship faster"
2. Granger extracts this as a decision and prepares to create a Linear issue
3. Priority doc `01-mission.md` says: "We don't ship without tests. Quality is non-negotiable."
4. Granger responds: "I extracted a decision to cut testing from the March 28 meeting. However, this conflicts with your mission doc which states quality is non-negotiable. Want me to create the task as stated, flag it for discussion, or skip it?"
5. Partner responds, Granger executes accordingly

---

## 5.5 What This Looks Like When Fully Implemented

A day in the life of Mirror Factory with Granger:

**7:00 AM** — Granger posts to `#granger-digest` in Discord:
> "Morning Alfonso. You have 3 overdue Linear items (COMP-27 MSA follow-up is 6 days late). Bobby's bank transfer task is still open. You have a meeting with Kyle at 2pm about Tennis Social — here's the relevant context from your last 2 meetings on this topic. The Alaris location pages are due this week in ClickUp."

**9:15 AM** — Alfonso opens the web UI, types: "What did we decide about Layers pricing?"
> Granger searches context library (Supabase semantic search, $0 token cost), finds 3 relevant extractions, cites the sources with timestamps and speakers: "In the March 23 MF Monday sync, Kyle proposed the tiered model. The decision was cost-plus-30% for the gateway tier. However, the pricing calculator (COMP-13) is still in Todo status. Want me to create a task to finalize it?"

**9:16 AM** — Alfonso says "Yes, create the task"
> Granger proposes: "Create Linear issue 'Finalize Layers pricing calculator' in Company team, assigned to Kyle, priority High, due April 5. This doesn't conflict with any priority docs. Approve?" Alfonso clicks ✅. Granger calls Linear GraphQL API directly ($0 token cost for the API call).

**11:00 AM** — Meeting ends. Granola processes the transcript. 15 minutes later, Granger's ingestion cron fires.
> Granger calls `GET /v1/notes?created_after=...` on Granola's API ($0), gets the new transcript, runs extraction via Sonnet 4.6 (~$0.01), stores in Supabase, posts to `#granger-alerts`: "New meeting processed: 'MF Weekly Sync'. 2 decisions, 3 action items. One decision ('delay the Discord launch') conflicts with priority doc 03-priorities.md which lists Discord bot as Q1. Review in approval queue."

**2:30 PM** — Kyle opens Discord, types: `/granger tasks`
> Granger queries Linear GraphQL API ($0), lists Kyle's in-progress issues, flags the 4 Tennis Social items due this week.

**4:00 PM** — Bobby DMs @Granger: "Draft an email to John about the MSA templates"
> Granger searches Gmail API ($0), finds context from the context library ($0), composes draft via Sonnet 4.6 (~$0.01), shows in DM. Bobby reacts ✅. Granger creates the Gmail draft ($0).

**2:00 AM** — Nightly synthesis cron fires.
> Opus 4.6 reviews 30 days of context (~$0.10, capped). Finds: "Layers pricing discussed in 4 meetings, not finalized. MSA template overdue 2 weeks across 3 meetings." Stores synthesis.

**Estimated daily cost for 3 partners: $1.50–$2.50** (mostly extraction + chat + nightly synthesis). Direct API calls are free.

---

## 6. Discord Bot

Granger runs as a full bot in the Mirror Factory Discord server. It's the same agent as the web UI — same priority docs, same tools, same context — but accessed through Discord instead of a browser.

### Architecture

- Discord.js v14 bot using Discord's HTTP-based interactions endpoint (serverless, fits Vercel model)
- Bot connects to the same Supabase database and AI Gateway as the web app
- Messages to Granger (DM or @mention) route through the same ToolLoopAgent with the same priority docs and tools
- Each message creates a conversation entry in `chat_messages` with `channel = 'discord'` and the Discord `channel_id` + `user_id` stored
- The same partner_settings (API keys, preferences) apply regardless of channel

### How Discord Communication Actually Works

```
Partner types "@Granger what happened in our last meeting?" in #general
  → Discord sends POST to your-app.vercel.app/api/discord/interactions
    → Handler identifies partner (Discord user ID → Supabase user via linked accounts)
    → Loads priority docs + partner's context
    → ToolLoopAgent runs with same tools as web:
      → query_granola (Granola API, $0) → search_context (Supabase, $0) → LLM reasons (~$0.01)
    → Bot responds in a Discord thread
    → Message + response stored in chat_messages (channel='discord')
```

**Discord DM flow (personal):**
```
Alfonso DMs @Granger "Draft an email to John about MSA"
  → Same flow, but conversation is private (only Alfonso sees it)
  → Granger searches Gmail API (Alfonso's personal OAuth token)
  → Proposes draft → Alfonso reacts ✅ → Granger creates Gmail draft
```

**Autonomous posting (no human trigger):**
```
Vercel Cron fires at 7 AM weekday → POST /api/cron/digest
  → For each partner: query their overdue Linear issues, upcoming meetings, recent decisions
  → Generate personalized digest via Sonnet 4.6
  → Post to #granger-digest via Discord API (Bot token)
  → Each partner sees their own section in the digest
```

### Discord Bot Setup (One-Time)

1. Create a Discord application at discord.com/developers/applications
2. Create a bot user, copy the bot token → store in env vars
3. Enable required intents: MESSAGE_CONTENT, GUILDS, GUILD_MESSAGES
4. Add bot to MF Discord server with permissions: Send Messages, Read Messages, Create Threads, Add Reactions, Use Slash Commands
5. Register slash commands via Discord API (on deploy)
6. Set up interactions endpoint URL: `https://your-app.vercel.app/api/discord/interactions`
7. Create channels: `#granger-digest` and `#granger-alerts`
8. Link Discord user IDs to Supabase user accounts (one-time mapping in `partner_settings`)

### Features

- **Slash commands**: `/granger ask [question]`, `/granger status`, `/granger tasks`, `/granger digest`
- **@mention**: Tag @Granger in any channel and it responds with full agent capabilities
- **Autonomous posting**: Granger posts morning digests to a `#granger-digest` channel at 7 AM
- **Autonomous alerts**: Granger posts to `#granger-alerts` when it detects overdue items, conflicts, or patterns
- **Thread replies**: Granger's responses are threaded to keep channels clean
- **Reactions**: Granger uses emoji reactions to acknowledge messages while processing (⏳ while working, ✅ when done)
- **Approval via reactions**: When Granger proposes an action in Discord, partners react with ✅ to approve or ❌ to reject

### Deployment

Deploy as a Vercel serverless function using Discord's HTTP interactions endpoint:

```
POST /api/discord/interactions → handles slash commands and @mentions
POST /api/cron/discord-digest → posts morning digest (Vercel Cron, 7 AM weekdays)
POST /api/cron/discord-alerts → posts overdue/pattern alerts (Vercel Cron, every 2 hours)
```

Register slash commands on deploy via Discord's API. No persistent WebSocket process needed.

---

## 7. Model Routing Strategy

Granger uses the Vercel AI Gateway with a single API key. The key routes to any model from any provider. Each task uses the most cost-effective model for its complexity.

### Task-to-Model Mapping

| Task | Primary Model | Fallback Models | Est. Cost |
|---|---|---|---|
| Ingestion / classification | `anthropic/claude-haiku-4.5` | `google/gemini-2.5-flash-lite`, `openai/gpt-5-nano` | ~$0.001/doc |
| Extraction (structured) | `anthropic/claude-sonnet-4.6` | `google/gemini-3-flash`, `openai/gpt-5.4-mini` | ~$0.01/doc |
| Chat (user-facing) | User-selected (9 models available) | Configurable per user | Varies |
| Synthesis (nightly) | `anthropic/claude-opus-4.6` | `google/gemini-3-pro`, `openai/gpt-5.4` | ~$0.10/run |
| Task sync | `anthropic/claude-haiku-4.5` | `openai/gpt-5-nano` | ~$0.001/task |
| Embeddings | `openai/text-embedding-3-small` | No fallback needed | ~$0.0001/doc |
| Digest generation | `anthropic/claude-sonnet-4.6` | `google/gemini-3-flash` | ~$0.02/digest |
| History compaction | `anthropic/claude-haiku-4.5` | `openai/gpt-5-nano` | ~$0.001/compaction |

### AI Gateway Fallback Configuration

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: 'anthropic/claude-sonnet-4.6',
  prompt: userMessage,
  providerOptions: {
    gateway: {
      models: [
        'google/gemini-3-flash',
        'openai/gpt-5.4-mini',
      ], // Fallback models if primary fails
    },
  },
});
```

### Per-Partner API Keys

Each partner can optionally set their own AI Gateway key in their profile settings. If set, their requests use their key. Otherwise, falls back to the shared team key.

```typescript
// src/lib/ai/config.ts
import { gateway } from '@ai-sdk/gateway';

export function getGateway(userId?: string) {
  const userKey = userId ? await getUserApiKey(userId) : null;
  return gateway({ apiKey: userKey || process.env.AI_GATEWAY_API_KEY });
}

// Usage in chat route:
const gw = getGateway(session.user.id);
const agent = new ToolLoopAgent({
  model: gw(selectedModel),
  // ...
});
```

---

## 8. Database Changes

The existing Supabase schema has most of what we need. Add these new tables and columns:

### New Tables

#### `priority_documents`

```sql
CREATE TABLE priority_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  weight INT NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE priority_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON priority_documents
  USING (org_id = (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
```

#### `credentials`

```sql
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id), -- nullable for org-wide creds
  provider TEXT NOT NULL, -- 'granola', 'linear', 'discord', 'notion', 'gmail', 'drive'
  token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON credentials
  USING (org_id = (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
```

#### `approval_queue`

```sql
CREATE TABLE approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  requested_by_agent TEXT NOT NULL, -- which agent proposed this
  action_type TEXT NOT NULL, -- 'create_task', 'send_message', 'draft_email', etc.
  target_service TEXT NOT NULL, -- 'linear', 'slack', 'gmail', etc.
  payload JSONB NOT NULL, -- the full action data
  reasoning TEXT, -- why the agent wants to do this
  conflict_reason TEXT, -- if priority doc conflict detected
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON approval_queue
  USING (org_id = (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
```

#### `partner_settings`

```sql
CREATE TABLE partner_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  ai_gateway_key_encrypted TEXT,
  default_model TEXT,
  discord_user_id TEXT, -- Links Discord user to Supabase account for DM routing
  notification_preferences JSONB DEFAULT '{}',
  approval_preferences JSONB DEFAULT '{}', -- per action type overrides
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE partner_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_settings" ON partner_settings
  USING (user_id = auth.uid());
```

### Columns to Add to Existing Tables

```sql
-- context_items
ALTER TABLE context_items ADD COLUMN priority_weight INT NOT NULL DEFAULT 0;
ALTER TABLE context_items ADD COLUMN confidence_score FLOAT DEFAULT 1.0;
ALTER TABLE context_items ADD COLUMN source_quote TEXT;

-- chat_messages
ALTER TABLE chat_messages ADD COLUMN channel TEXT NOT NULL DEFAULT 'web'; -- 'web' or 'discord'
ALTER TABLE chat_messages ADD COLUMN discord_channel_id TEXT; -- Discord channel/DM ID for threading
ALTER TABLE chat_messages ADD COLUMN discord_message_id TEXT; -- Discord message ID for reactions/edits

-- conversations
ALTER TABLE conversations ADD COLUMN compacted_summary TEXT;
```

---

## 9. Agent Tools

The existing agent has 2 tools (`search_context`, `get_document`). Granger needs more. Each tool wraps a zero-token API call as a ToolLoopAgent tool.

### Tool Registry

| Tool Name | Source | What It Does | Token Cost |
|---|---|---|---|
| `search_context` | Supabase | Hybrid semantic + keyword search (existing) | ~50 tokens (tool def) |
| `get_document` | Supabase | Fetch full document by ID (existing) | ~30 tokens |
| `list_linear_issues` | Linear API | Query issues with filters (status, assignee, priority, due date) | **0 AI tokens** |
| `create_linear_issue` | Linear API | Create issue → routes through approval queue | **0 AI tokens** |
| `update_linear_issue` | Linear API | Update status/assignee/priority → routes through approval queue | **0 AI tokens** |
| `search_gmail` | Gmail API | Search emails with Gmail query syntax | **0 AI tokens** |
| `draft_email` | Gmail API | Create draft → routes through approval queue | **0 AI tokens** |
| `read_slack_channel` | Slack API | Read recent messages from a channel | **0 AI tokens** |
| `send_slack_message` | Slack API | Send message → routes through approval queue | **0 AI tokens** |
| `query_granola` | Granola API | Search meetings and transcripts | **0 AI tokens** |
| `search_notion` | Notion API | Search pages and databases | **0 AI tokens** |
| `list_drive_files` | Drive API | Search and list Google Drive files | **0 AI tokens** |
| `get_calendar` | Google Calendar API | Check schedule and availability | **0 AI tokens** |
| `create_document` | Filesystem | Write a file viewable on the server (Vercel Sandbox pattern) | **0 AI tokens** |
| `propose_action` | Supabase | Add write action to approval queue with conflict check | **0 AI tokens** |

**Key insight: 13 of 15 tools cost zero AI tokens.** The LLM decides WHICH tool to call (that costs tokens). But the tool execution itself is a direct API call.

### Tool Implementation Pattern

```typescript
// src/lib/ai/tools.ts
import { tool } from 'ai';
import { z } from 'zod';
import { linearClient } from '../api/linear';

export const listLinearIssues = tool({
  name: 'list_linear_issues',
  description: 'Query Linear issues with filters. Use for finding tasks, checking status, seeing what is assigned to whom.',
  inputSchema: z.object({
    state: z.enum(['started', 'unstarted', 'completed', 'canceled']).optional(),
    assignee: z.string().optional().describe('User name, email, or "me"'),
    priority: z.number().optional().describe('1=Urgent, 2=High, 3=Normal, 4=Low'),
    limit: z.number().default(20),
  }),
  execute: async (input) => {
    // Direct API call — zero LLM tokens
    const issues = await linearClient.listIssues(input);
    return { issues: issues.map(i => ({
      id: i.id, title: i.title, status: i.status,
      assignee: i.assignee, priority: i.priority,
      dueDate: i.dueDate, url: i.url,
    }))};
  },
});
```

### Write Tools Route Through Approval

```typescript
export const createLinearIssue = tool({
  name: 'create_linear_issue',
  description: 'Create a new Linear issue. Requires approval before execution.',
  inputSchema: z.object({
    title: z.string(),
    team: z.string(),
    description: z.string().optional(),
    priority: z.number().optional(),
    assignee: z.string().optional(),
  }),
  execute: async (input, { orgId }) => {
    // Route through approval queue — NOT directly to Linear
    const proposal = await db.from('approval_queue').insert({
      org_id: orgId,
      requested_by_agent: 'granger',
      action_type: 'create_task',
      target_service: 'linear',
      payload: input,
      status: 'pending',
    });
    return {
      message: `Proposed creating Linear issue "${input.title}" in ${input.team}. Waiting for approval.`,
      approval_id: proposal.id,
    };
  },
});
```

---

## 10. Sprint Plan

Builder: Alfonso with Claude Code. Timeline: 2–3 weeks. Start from Layers 2026.1 codebase.

### Sprint 1 (Days 1–5): Foundation

**Goal: Priority docs loaded, model strings updated, Nango replaced for first 2 sources, approval queue wired.**

- [ ] Update all model strings in `src/lib/ai/config.ts` to current AI Gateway models (see Section 2)
- [ ] Add 3 new fast-tier models: `claude-haiku-4.5`, `gpt-5-nano`, `gemini-2.5-flash-lite`
- [ ] Create `/docs/priority/` with 5 initial markdown files (`01-mission` through `05-agent`)
- [ ] Build `src/lib/ai/priority-docs.ts` — `loadPriorityDocs()` function
- [ ] Wire priority docs into ToolLoopAgent instructions in `src/app/api/chat/route.ts`
- [ ] Increase `stepCountIs` from 6 to 10 for longer reasoning chains
- [ ] Create database migrations: `priority_documents`, `credentials`, `approval_queue`, `partner_settings`
- [ ] Add new columns to `context_items` (`priority_weight`, `confidence_score`, `source_quote`)
- [ ] Add `channel` column to `chat_messages`, `compacted_summary` to `conversations`
- [ ] Build `src/lib/api/granola.ts` — direct API replacing Nango for Granola
- [ ] Build `src/lib/api/linear.ts` — direct API replacing Nango for Linear
- [ ] Build `src/lib/api/types.ts` — shared types for all API integrations
- [ ] Build `propose_action` tool and approval queue insert logic
- [ ] Build approval card UI component (`src/components/approval-card.tsx`)
- [ ] Build per-partner API key settings page (`src/components/partner-settings.tsx`)
- [ ] Implement `getGateway(userId)` for per-partner key fallback

### Sprint 2 (Days 6–10): Remaining APIs + Conversation Loop

**Goal: All 6 data sources connected. History compaction working. Chat feels like Claude Code.**

- [ ] Build `src/lib/api/discord.ts` — Discord REST API for reading channels/messages
- [ ] Build `src/lib/api/notion.ts` — Notion API for reading pages and databases
- [ ] Build `src/lib/api/gmail.ts` — Gmail API with Google OAuth flow
- [ ] Build `src/lib/api/drive.ts` — Drive API (shares Google OAuth with Gmail)
- [ ] Build Google OAuth flow for Gmail + Drive (token exchange, refresh, storage in `credentials` table)
- [ ] Implement `src/lib/ai/compact.ts` — conversation history compaction
- [ ] Store `compacted_summary` in conversations table, load on conversation resume
- [ ] Add all new agent tools to `src/lib/ai/tools.ts` (see Section 9 for full list)
- [ ] Implement values-based conflict detection: before `propose_action`, check payload against priority docs
- [ ] Wire `conflict_reason` field in approval queue
- [ ] Build approval queue page (`/approvals`) showing pending, approved, rejected items
- [ ] Test end-to-end: ask Granger about a meeting → search context → propose action → approve → execute

### Sprint 3 (Days 11–15): Discord Bot + Proactive Intelligence

**Goal: Granger lives in Discord. Morning digests work. Overdue detection works.**

- [ ] Set up Discord.js bot application (bot token, permissions, intents)
- [ ] Register slash commands via Discord API on deploy
- [ ] Build `POST /api/discord/interactions` endpoint for HTTP interactions
- [ ] Implement `/granger ask [question]` — route through same ToolLoopAgent
- [ ] Implement `/granger status` — summary of overdue items, pending approvals
- [ ] Implement `/granger tasks` — list in-progress Linear issues
- [ ] Implement `/granger digest` — on-demand digest generation
- [ ] Implement @mention handling — detect @Granger in any channel, respond in thread
- [ ] Share conversation history between web and Discord via `channel` field
- [ ] Build proactive digest cron (`POST /api/cron/digest`, 7 AM weekdays): personalized per partner
- [ ] Build overdue detection: scan Linear issues + context items for past-due action items
- [ ] Build `POST /api/cron/discord-alerts` — post overdue/pattern alerts every 2 hours
- [ ] Create `#granger-digest` and `#granger-alerts` channels in MF Discord
- [ ] Implement emoji reactions: ⏳ while processing, ✅ when done
- [ ] Implement approval via reactions: ✅ approve, ❌ reject proposals posted in Discord

### Sprint 4 (Days 16–20): Polish + Extraction Pipeline

**Goal: Production-ready for daily MF use. All 3 partners using it.**

- [ ] Expand extraction schema in `src/lib/ai/extract.ts`: add `emotional_signals`, `tacit_observations`, `confidence_score`, `source_quote`
- [ ] Build nightly synthesis cron (`POST /api/cron/synthesis`, 2 AM): Opus 4.6 reviews 30 days of context
- [ ] Synthesis agent spawns extraction subagents for parallel processing
- [ ] Cap synthesis cost at $0.50/run via token limit
- [ ] Build pre-meeting prep: before a scheduled meeting (via Google Calendar), push relevant context
- [ ] Tune Granola ingestion cron: polling every 15 minutes via `POST /api/cron/ingest`
- [ ] Build pattern detection: flag topics in 3+ consecutive meetings without resolution
- [ ] Remove all remaining Nango code and `@nangohq` dependencies
- [ ] End-to-end testing across all flows (web chat, Discord, approval, digest, extraction)
- [ ] Mobile-responsive chat interface
- [ ] Deploy to production Vercel + Supabase
- [ ] Onboard Kyle and Bobby — have each connect their API keys and test

---

## 11. Success Criteria

P1 is successful when all 3 Mirror Factory partners use Granger daily. Specific criteria:

- [ ] Granger can answer "what happened in our last meeting?" by querying Granola, extracting context, and citing the source
- [ ] Granger can create a Linear issue from a meeting decision, with approval workflow
- [ ] Granger can draft a follow-up email from a meeting, with approval before sending
- [ ] Granger flags a conflict when a proposed action contradicts a priority document
- [ ] Granger's Discord bot responds to @mentions and slash commands with full agent capabilities
- [ ] Granger posts a morning digest to Discord by 7 AM with overdue items and today's context
- [ ] A conversation started on Discord can be continued on the web UI (shared history)
- [ ] Each partner can set their own AI Gateway key in settings
- [ ] ~80% of Granger's operations cost zero AI tokens (direct API calls)
- [ ] Total AI cost for daily operation of 3 partners: under $2/day

---

## 12. File Structure Changes

New files and directories to create in the Layers 2026.1 codebase:

```
docs/
  priority/
    01-mission.md
    02-team.md
    03-priorities.md
    04-clients.md
    05-agent.md

src/lib/api/                        # NEW: Direct API integrations (replacing Nango)
  granola.ts                        # Granola REST API client
  linear.ts                         # Linear GraphQL API client
  discord.ts                        # Discord REST API client
  notion.ts                         # Notion REST API client
  gmail.ts                          # Gmail API client (Google OAuth)
  drive.ts                          # Drive API client (shares Google OAuth)
  types.ts                          # Shared types for all API integrations

src/lib/ai/
  priority-docs.ts                  # NEW: Load priority docs from /docs/priority/
  config.ts                         # MODIFY: Update model strings, add getGateway()
  tools.ts                          # MODIFY: Add 13 new tools (see Section 9)
  compact.ts                        # NEW: History compaction logic
  extract.ts                        # MODIFY: Expand extraction schema

src/app/api/
  discord/
    interactions/route.ts           # NEW: Discord bot HTTP interactions endpoint
  approval/
    route.ts                        # NEW: List pending approvals
    [id]/route.ts                   # NEW: Approve/reject individual action
  cron/
    digest/route.ts                 # NEW: Morning digest generation (7 AM weekdays)
    ingest/route.ts                 # NEW: Granola polling (every 15 min)
    synthesis/route.ts              # NEW: Nightly synthesis (2 AM)
    discord-alerts/route.ts         # NEW: Overdue/pattern alerts (every 2 hours)

src/app/(dashboard)/
  approvals/page.tsx                # NEW: Approval queue UI
  settings/
    api-keys/page.tsx               # NEW: Per-partner API key management

src/components/
  approval-card.tsx                 # NEW: Individual approval item with approve/reject
  approval-queue.tsx                # NEW: Full queue view
  partner-settings.tsx              # NEW: API key + preferences form

supabase/migrations/
  XXXXXX_priority_documents.sql     # NEW
  XXXXXX_credentials.sql            # NEW
  XXXXXX_approval_queue.sql         # NEW
  XXXXXX_partner_settings.sql       # NEW
  XXXXXX_add_context_columns.sql    # NEW: priority_weight, confidence_score, source_quote
  XXXXXX_add_chat_channel.sql       # NEW: channel column on chat_messages
  XXXXXX_add_compacted_summary.sql  # NEW: compacted_summary on conversations
```

---

## 13. Final Notes

- **This is NOT a rewrite.** It's an evolution of Layers 2026.1. The infrastructure is built. We're adding the agent layer, priority system, approval workflow, Discord bot, and direct API integrations on top.
- **The 60-second Vercel timeout** is a known limitation. For P1 with 3 users, it works. If extraction bottlenecks, move to Inngest for background processing in a later sprint.
- **The Nango removal** is the biggest migration risk. Do it source by source: Granola first (simplest — just an API key), then Linear (API key), then Google OAuth sources (Gmail + Drive share auth). Discord and Notion are new integrations, not migrations.
- **Discord bot** should use the HTTP interactions endpoint (serverless) not WebSocket gateway (persistent process). This fits the Vercel model.
- **The priority document system is what makes Granger different** from every other AI tool. Don't skip it or simplify it. This is the feature.
- **Test everything against real data.** The MCPs are live in Claude.ai right now — pull real Linear issues, real Gmail messages, real Granola meetings to verify the extraction and tool patterns work correctly before building the direct API equivalents.
- **Estimated monthly AI cost for 3 partners:** $30–60/month (mostly extraction + synthesis + chat). Direct API calls to Linear, Gmail, Granola, etc. are free.
