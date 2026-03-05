# Layers Platform — Technical Development Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LAYERS PLATFORM                               │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Inbox /   │  │    Chat      │  │   Session    │               │
│  │  Dashboard  │  │  Interface   │  │  Workspaces  │               │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                │                  │                        │
│  ┌──────┴──────────────┴──────────────────┴───────┐                │
│  │              Next.js App (Monolith)             │                │
│  │   API Routes + Server Actions + React UI        │                │
│  └──────────────────────┬──────────────────────────┘                │
│                          │                                           │
│  ┌───────────┐  ┌───────┴────────┐  ┌──────────────┐              │
│  │  Nango    │  │  Vercel AI SDK │  │  Supabase    │              │
│  │  (Auth +  │  │  + AI Gateway  │  │  (Postgres + │              │
│  │  Sync +   │  │  (All AI ops)  │  │  pgvector +  │              │
│  │  Connect) │  │                │  │  Edge Funcs) │              │
│  └─────┬─────┘  └───────┬────────┘  └──────┬───────┘              │
│        │                │                   │                       │
│  ┌─────┴─────────────────┴───────────────────┴─────┐               │
│  │              External Services                    │               │
│  │  Google Drive │ Linear │ Discord │ Granola │ etc  │               │
│  └───────────────────────────────────────────────────┘               │
│                                                                       │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │  Stripe (Payments)   │  │  AI Gateway Models   │                │
│  │  (Already Built)     │  │  (100+ via Vercel)   │                │
│  └──────────────────────┘  └──────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Version / Detail | Why |
|---|---|---|---|
| Framework | Next.js | Latest (App Router) | Solo-builder monolith — expert consensus says monoliths outperform microservices below 10 developers. Built-in API routes eliminate separate backend. |
| AI Core | Vercel AI SDK | `ai` package | Unified interface to generateText, streamText, generateObject, Agent patterns. Default stack. |
| AI Models | Vercel AI Gateway | `ai-gateway.vercel.sh/v3/ai` | Single endpoint for 100+ models across 20+ providers. Fallback routing, usage tracking. |
| UI Components | AI Elements (shadcn) | Latest | Chat interfaces, streaming UI, tool approval patterns. Default stack. |
| Database | Supabase (Postgres + pgvector) | Postgres 15+ with pgvector extension | Benchmarks show pgvector achieves 4x higher QPS than Pinecone with 0.99 accuracy@10 vs 0.94. Hybrid search (vectors + full-text + metadata) in a single SQL query. No new services needed. |
| Auth | Supabase Auth | Already built | Row-Level Security for multi-tenant data isolation. |
| Payments | Stripe | Already built | Credit tracking, billing, checkout flows from Gateway phase. |
| Integration Hub | Nango | Cloud free tier → self-host later | OAuth for 700+ APIs, white-label connect UI, credential storage, token refresh, MCP server, data sync. Eliminates weeks of auth plumbing. |
| Background Jobs | Supabase Edge Functions | Deno runtime | Registry pipeline processing (extract, embed, link). Runs alongside database, no new infra. |
| Deployment | Vercel | Standard | Automatic deploys, edge functions, preview environments. |

### Research Sources for Stack Decisions

**pgvector over Pinecone:**
- Supabase benchmark: pgvector achieves 4x better QPS and 0.99 accuracy vs 0.94 (Source: supabase.com/blog/pgvector-vs-pinecone)
- Confident AI replaced Pinecone with pgvector because "the bottleneck was network request latency, not search performance" and Pinecone "unduly complicates a standard data storage architecture" (Source: confident-ai.com/blog/why-we-replaced-pinecone-with-pgvector)
- 2026 benchmark: "Supabase is fast enough for 99% of B2B SaaS apps" and "wins hybrid search hands down" because you can combine vector + full-text + metadata in one SQL query (Source: geetopadesha.com/vector-search-in-2026-pinecone-vs-supabase-pgvector-performance-test)
- Timescale benchmark on 50M embeddings: pgvector achieves 28x lower p95 latency and 16x higher throughput vs Pinecone s1, at 75% lower cost (Source: tigerdata.com/blog/pgvector-vs-pinecone)

**Monolith over microservices:**
- "For small-to-medium apps or solo developers, monolithic architecture remains the easiest to get started with" (Source: dev.to — Ultimate Guide to Software Architecture in Next.js)
- "Experts reached consensus in 2025: below 10 developers, monoliths perform better" (Source: foojay.io/today/monolith-vs-microservices-2025)
- "Next.js's built-in API routes eliminate the need for separate backend services" (Source: Medium — NextJS: The Monolith We Now Love)
- "A small unified application might run happily on a $20/month server" vs significantly more for microservices (Source: strapi.io — Monolithic Architecture Guide)

**Nango as integration hub:**
- "Nango supports 700+ APIs, handles auth, execution, scaling, and observability" with "less than 100ms overhead to tool calls" (Source: nango.dev/docs/getting-started/intro-to-nango)
- "Powers millions of users for companies like Replit, Mercor, Exa" (Source: github.com/NangoHQ/nango)
- Built-in MCP server for exposing integrations to AI agents (Source: nango.dev)
- White-label Connect UI embeddable with one line of code (Source: nango.dev)
- Compared favorably to Composio for data sync + agent action hybrid patterns (Source: composio.dev/blog/nango-alternatives-ai-agents)

## AI SDK Integration Map

This is the core mapping of every product feature to a specific Vercel AI SDK function, model, UI component, and pattern.

| Feature | AI SDK Function | AI Gateway Model | AI Elements Component | SDK Pattern |
|---|---|---|---|---|
| Chat interface (ask questions about data) | `streamText()` | `anthropic/claude-sonnet-4` | `useChat` + Chat UI | Chat-Base Clone |
| Meeting transcript summarization | `generateObject()` | `anthropic/claude-sonnet-4` | — (background) | Structured Output |
| Entity extraction (who/what/when/where) | `generateObject()` with Zod schema | `openai/gpt-4o-mini` (fast, cheap) | — (background) | Claude/OpenAI Structured Output |
| Action item extraction | `generateObject()` | `openai/gpt-4o-mini` | — (background) | Structured Output |
| Semantic search query understanding | `generateText()` | `openai/gpt-4o-mini` | — (API route) | Generate Text |
| Embedding generation | `embed()` | `openai/text-embedding-3-small` | — (background) | Embeddings |
| Draft follow-up email | `streamText()` | `anthropic/claude-sonnet-4` | `useChat` + Streaming UI | Stream Text |
| Daily digest generation | `generateText()` | `anthropic/claude-sonnet-4` | — (cron) | Generate Text |
| Session agent (multi-step reasoning) | `Agent()` with tools | `anthropic/claude-sonnet-4` | `useChat` + Tool Approval | Agent + Multi-Step Tool Pattern |
| Context relevance scoring | `generateObject()` | `openai/gpt-4o-mini` | — (background) | Structured Output |
| Inbox item prioritization | `generateObject()` | `openai/gpt-4o-mini` | — (background) | Output.array |
| Cross-source connection finding | `Agent()` with search tools | `anthropic/claude-sonnet-4` | — (background) | Agentic Context Builder |
| Natural language to registry query | `generateObject()` | `openai/gpt-4o-mini` | — (API route) | Structured Output |

### Model Selection Rationale

- **anthropic/claude-sonnet-4** for user-facing generation (chat, drafts, digests): Best balance of quality and speed for conversational AI. Strong at following complex instructions and maintaining context.
- **openai/gpt-4o-mini** for background extraction and classification: Fast, cheap ($0.15/1M input tokens), and reliable for structured output. Entity extraction doesn't need frontier-level reasoning.
- **openai/text-embedding-3-small** for embeddings: Cost-effective (62,500 pages per dollar), 1536 dimensions, strong performance on retrieval benchmarks.
- **AI Gateway fallbacks**: All calls use `providerOptions.gateway.models` for automatic fallback (e.g., Claude → GPT-4o → Gemini) ensuring uptime.

## Data Model

### Core Entities

```typescript
// Context Library — the heart of the system
model ContextItem {
  id              String    @id @default(uuid())
  orgId           String    // Multi-tenant isolation
  sourceType      String    // 'granola' | 'linear' | 'discord' | 'gdrive' | 'upload'
  sourceId        String?   // External ID from source system
  nangoConnectionId String? // Nango connection that produced this item
  
  // Multi-level descriptions (progressive context loading)
  title           String
  descriptionShort String   // One line — cheapest lookup
  descriptionLong  String?  // Paragraph — medium cost
  rawContent      String?   // Full content — expensive
  contentType     String    // 'meeting_transcript' | 'document' | 'message' | 'issue' | 'file'
  
  // Structured extraction (from generateObject pipeline)
  entities        Json?     // { people, decisions, actionItems, topics, projects, dates }
  
  // Vector embedding for semantic search
  embedding       Vector(1536)? // pgvector column, text-embedding-3-small
  
  // Processing status
  status          String    @default("pending") // 'pending' | 'processing' | 'ready' | 'error'
  
  // Relationships
  sessionLinks    SessionContextLink[]
  sourceMetadata  Json?     // Source-specific data (attendees, channel, folder, etc.)
  
  // Timestamps
  ingestedAt      DateTime  @default(now())
  sourceCreatedAt DateTime? // When the original content was created
  processedAt     DateTime?
  
  @@index([orgId, status])
  @@index([orgId, sourceType])
  @@index([orgId, contentType])
}

// Extraction schema for generateObject() — what gets stored in entities JSON
const ExtractionSchema = z.object({
  people: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    email: z.string().optional(),
  })),
  decisions: z.array(z.object({
    decision: z.string(),
    context: z.string().optional(),
    madeBy: z.string().optional(),
  })),
  actionItems: z.array(z.object({
    task: z.string(),
    owner: z.string().optional(),
    deadline: z.string().optional(),
    status: z.enum(['pending', 'done', 'cancelled']).default('pending'),
  })),
  topics: z.array(z.string()),
  projects: z.array(z.string()),
  dates: z.array(z.object({
    date: z.string(),
    context: z.string(),
  })),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).optional(),
  summary: z.string(), // 2-3 sentence overview
})

// Sessions — scoped project containers
model Session {
  id              String    @id @default(uuid())
  orgId           String
  name            String
  goal            String    // System prompt / purpose
  status          String    @default("active") // 'active' | 'paused' | 'archived'
  agentConfig     Json?     // Model preferences, tool permissions, polling interval
  
  contextLinks    SessionContextLink[]
  createdBy       String    // User ID
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  lastAgentRun    DateTime?
  
  @@index([orgId, status])
}

// Many-to-many: sessions reference context items
model SessionContextLink {
  id              String    @id @default(uuid())
  sessionId       String
  contextItemId   String
  relevanceScore  Float?    // Agent-assigned relevance (0-1)
  addedBy         String    // 'auto' | user ID
  
  session         Session      @relation(fields: [sessionId], references: [id])
  contextItem     ContextItem  @relation(fields: [contextItemId], references: [id])
  
  @@unique([sessionId, contextItemId])
}

// Inbox items — unprocessed or attention-needed items
model InboxItem {
  id              String    @id @default(uuid())
  orgId           String
  userId          String    // Which team member this is for
  contextItemId   String?   // Linked context item
  
  type            String    // 'action_item' | 'decision' | 'mention' | 'new_context' | 'overdue'
  title           String
  body            String?
  priority        String    @default("normal") // 'urgent' | 'high' | 'normal' | 'low'
  status          String    @default("unread") // 'unread' | 'read' | 'acted' | 'dismissed'
  
  sourceType      String?   // Where this came from
  sourceUrl       String?   // Deep link back to source
  
  createdAt       DateTime  @default(now())
  readAt          DateTime?
  
  @@index([orgId, userId, status])
}

// Organizations (from Layers Gateway — already built)
model Organization {
  id              String    @id @default(uuid())
  name            String
  slug            String    @unique
  stripeCustomerId String?
  creditBalance   Int       @default(0)
  createdAt       DateTime  @default(now())
}

model OrgMember {
  id              String    @id @default(uuid())
  orgId           String
  userId          String
  role            String    @default("member") // 'owner' | 'admin' | 'member'
  
  @@unique([orgId, userId])
}

// Integration connections (managed by Nango, tracked locally)
model Integration {
  id              String    @id @default(uuid())
  orgId           String
  provider        String    // 'google-drive' | 'linear' | 'discord' | 'granola'
  nangoConnectionId String  // Reference to Nango's connection
  status          String    @default("active") // 'active' | 'paused' | 'error'
  lastSyncAt      DateTime?
  syncConfig      Json?     // Provider-specific config (folders, channels, projects to watch)
  
  createdBy       String
  createdAt       DateTime  @default(now())
  
  @@unique([orgId, provider])
}
```

## API Routes

### Context Library

| Method | Path | Purpose | AI SDK Function |
|---|---|---|---|
| GET | `/api/context` | List context items with filters (source, type, date, search) | — |
| GET | `/api/context/[id]` | Get single context item with full content | — |
| POST | `/api/context/search` | Semantic + full-text hybrid search | `embed()` for query vector |
| POST | `/api/context/ingest` | Webhook receiver for Nango sync events | — |
| POST | `/api/context/process` | Trigger extraction pipeline for a context item | `generateObject()` + `embed()` |

### Chat & Agent

| Method | Path | Purpose | AI SDK Function |
|---|---|---|---|
| POST | `/api/chat` | Main chat endpoint — query across all context | `streamText()` with tools |
| POST | `/api/chat/session/[id]` | Session-scoped chat — query within session context | `streamText()` with scoped tools |
| POST | `/api/agent/run` | Execute agent task (summarize, draft, analyze) | `Agent()` with `maxSteps` |

### Sessions

| Method | Path | Purpose | AI SDK Function |
|---|---|---|---|
| GET | `/api/sessions` | List active sessions | — |
| POST | `/api/sessions` | Create new session | — |
| PATCH | `/api/sessions/[id]` | Update session (name, goal, config) | — |
| POST | `/api/sessions/[id]/link` | Link context items to session | `generateObject()` for relevance scoring |

### Inbox

| Method | Path | Purpose | AI SDK Function |
|---|---|---|---|
| GET | `/api/inbox` | Get inbox items for current user | — |
| PATCH | `/api/inbox/[id]` | Update inbox item status (read, acted, dismissed) | — |
| POST | `/api/inbox/generate` | Generate inbox items from recent context | `generateObject()` with Output.array |

### Integrations (Nango-backed)

| Method | Path | Purpose | AI SDK Function |
|---|---|---|---|
| POST | `/api/integrations/connect` | Initialize Nango Connect UI for a provider | — |
| GET | `/api/integrations` | List connected integrations for org | — |
| DELETE | `/api/integrations/[id]` | Disconnect an integration | — |
| POST | `/api/integrations/webhook` | Nango webhook receiver for sync events | — |

### Admin (Already Built — from Gateway)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/usage` | Usage metrics across org |
| GET | `/api/admin/credits` | Credit balance and history |
| POST | `/api/admin/credits/purchase` | Stripe Checkout for credits |

## Key Flows

### Flow 1: Data Ingestion (Granola Meeting Transcript)

```
1. Meeting ends in Granola
2. granola-webhook daemon detects new note in cache-v3.json
   (OR Nango sync picks up new Granola document)
3. Webhook fires to POST /api/context/ingest
   Payload: { source: 'granola', content: rawTranscript, metadata: { attendees, date, title } }
4. API route creates ContextItem with status: 'pending'
   Item immediately visible in Inbox as "New meeting: [title]"
5. Triggers Supabase Edge Function: process-context
6. Edge Function Step 1 — Extract (10-30s):
   generateObject({
     model: 'openai/gpt-4o-mini',
     schema: ExtractionSchema,
     prompt: `Extract entities from this meeting transcript: ${rawContent}`
   })
   → Stores structured entities in ContextItem.entities
   → Sets descriptionShort and descriptionLong
7. Edge Function Step 2 — Embed (2-5s):
   embed({
     model: 'openai/text-embedding-3-small',
     value: descriptionLong
   })
   → Stores vector in ContextItem.embedding
8. Edge Function Step 3 — Link (5-10s):
   generateObject({
     model: 'openai/gpt-4o-mini',
     schema: z.object({ matchedSessions: z.array(z.string()), matchedProjects: z.array(z.string()) }),
     prompt: `Given these active sessions: ${sessions}, which does this content relate to? Content: ${descriptionLong}`
   })
   → Creates SessionContextLink entries
   → If action items extracted, creates InboxItem entries for relevant team members
9. Sets ContextItem.status = 'ready'
   Total pipeline time: < 60 seconds
```

### Flow 2: Chat Query ("What did we decide about pricing?")

```
1. User types query in chat interface (useChat hook)
2. POST /api/chat with messages array
3. Server route:
   a. Generate query embedding:
      embed({ model: 'openai/text-embedding-3-small', value: query })
   b. Hybrid search in Supabase:
      - pgvector cosine similarity on embedding column
      - Full-text search (tsvector) on descriptionLong + rawContent
      - Metadata filter on entities->>'topics' 
      - Combined ranking with RRF (Reciprocal Rank Fusion)
   c. Top 5-10 results become tool context
4. streamText({
     model: 'anthropic/claude-sonnet-4',
     messages: [...history, { role: 'user', content: query }],
     system: `You are a business context assistant. Answer using ONLY the provided context. 
              Cite sources by name and date. If you don't know, say so.`,
     tools: {
       searchContext: tool({
         description: 'Search the context library for relevant information',
         parameters: z.object({ query: z.string(), filters: z.object({...}).optional() }),
         execute: async ({ query, filters }) => { /* hybrid search */ }
       }),
       getFullContent: tool({
         description: 'Get the full content of a context item when summary isn\'t enough',
         parameters: z.object({ contextItemId: z.string() }),
         execute: async ({ contextItemId }) => { /* fetch rawContent */ }
       })
     },
     maxSteps: 5
   })
5. Stream response to client via toDataStreamResponse()
```

### Flow 3: Morning Inbox Generation

```
1. Vercel Cron triggers POST /api/inbox/generate at 7:00 AM
2. For each team member:
   a. Fetch ContextItems ingested since last inbox generation
   b. Fetch overdue action items from all ContextItem.entities
   c. generateObject({
        model: 'openai/gpt-4o-mini',
        schema: z.object({
          items: z.array(z.object({
            title: z.string(),
            body: z.string(),
            priority: z.enum(['urgent', 'high', 'normal', 'low']),
            type: z.enum(['action_item', 'decision', 'mention', 'new_context', 'overdue']),
            contextItemId: z.string().optional(),
          }))
        }),
        prompt: `Given this user's active sessions and recent context, 
                 generate prioritized inbox items. User: ${user}, 
                 New context: ${recentItems}, Overdue items: ${overdueItems}`
      })
   d. Batch insert InboxItems
3. Optional: Send digest notification (email or Discord DM)
```

## Component Architecture

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (dashboard)/
│   ├── layout.tsx                 # Main app shell with sidebar
│   ├── page.tsx                   # Inbox view (landing page)
│   ├── chat/page.tsx              # Global chat interface
│   ├── library/
│   │   ├── page.tsx               # Context library browser
│   │   └── [id]/page.tsx          # Single context item detail
│   ├── sessions/
│   │   ├── page.tsx               # Sessions list
│   │   └── [id]/page.tsx          # Session workspace with scoped chat
│   ├── integrations/page.tsx      # Connect tools (Nango Connect UI)
│   └── settings/page.tsx          # Team, billing, preferences
├── api/
│   ├── chat/route.ts              # Main chat endpoint
│   ├── chat/session/[id]/route.ts # Session-scoped chat
│   ├── context/route.ts           # CRUD for context items
│   ├── context/search/route.ts    # Hybrid search
│   ├── context/ingest/route.ts    # Webhook receiver
│   ├── context/process/route.ts   # Trigger extraction pipeline
│   ├── sessions/route.ts          # Session CRUD
│   ├── inbox/route.ts             # Inbox CRUD
│   ├── inbox/generate/route.ts    # Cron-triggered inbox generation
│   ├── integrations/route.ts      # Integration management
│   └── integrations/webhook/route.ts # Nango webhook receiver
└── components/
    ├── inbox/
    │   ├── InboxList.tsx           # Main inbox feed
    │   ├── InboxItem.tsx           # Individual inbox card
    │   └── InboxFilters.tsx        # Filter by type, priority, source
    ├── chat/
    │   ├── ChatPanel.tsx           # useChat wrapper with AI Elements
    │   ├── MessageBubble.tsx       # Message display with source citations
    │   └── ToolApproval.tsx        # Human-in-the-loop for agent actions
    ├── library/
    │   ├── ContextGrid.tsx         # Browse context items
    │   ├── ContextCard.tsx         # Preview card with source badge
    │   └── SearchBar.tsx           # Hybrid search input
    ├── sessions/
    │   ├── SessionList.tsx         # Active sessions sidebar
    │   ├── SessionWorkspace.tsx    # Session detail with scoped chat
    │   └── CreateSessionDialog.tsx # New session form
    ├── integrations/
    │   ├── ConnectPanel.tsx        # Nango Connect UI wrapper
    │   └── IntegrationStatus.tsx   # Connection health indicators
    └── shared/
        ├── Sidebar.tsx             # Main navigation
        ├── Header.tsx              # User menu, org switcher
        └── SourceBadge.tsx         # Visual indicator for data source
```

## Authentication & Multi-Tenancy

Authentication uses Supabase Auth (already built from Gateway phase). Multi-tenancy is enforced through Row-Level Security (RLS) policies on every table.

```sql
-- Every table with orgId gets this policy
CREATE POLICY "Users can only access their org's data" ON context_items
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );
```

User → Organization membership determines data visibility. All queries are automatically scoped by RLS — no application-level filtering needed.

## Integration Hub: Nango Implementation

### Why Nango (Research-Backed)

The alternative to Nango is building individual OAuth flows, token storage, refresh logic, and connection UIs for each of the 5+ services Layers connects to. This represents 2-4 weeks of integration plumbing per service.

Nango eliminates this entirely:

- **OAuth management**: Handles the full OAuth lifecycle for 700+ APIs including Google, Linear, Discord, and custom APIs (Source: nango.dev/docs)
- **White-label Connect UI**: Users see a branded connection flow, not Nango's UI (Source: nango.dev)
- **Token refresh**: Automatic credential refresh, expiry detection, and webhook alerts (Source: nango.dev/docs)
- **MCP server**: All connected integrations are automatically exposed as tools for AI agents (Source: nango.dev)
- **Multi-tenant**: Per-user credential isolation built-in — critical for Layers' team model (Source: nango.dev/docs)
- **Production-proven**: Used by Replit, Mercor, Exa, and hundreds of other companies (Source: github.com/NangoHQ/nango)
- **Cost**: Free tier available; overage at $1/connection/month and $0.10/1K requests (Source: nango.dev/pricing)

### Nango Setup

```typescript
// lib/nango.ts
import { Nango } from '@nangohq/node';

export const nango = new Nango({
  secretKey: process.env.NANGO_SECRET_KEY!,
});

// Frontend: Trigger connect UI
// components/integrations/ConnectPanel.tsx
import Nango from '@nangohq/frontend';

const nangoFrontend = new Nango({ publicKey: process.env.NEXT_PUBLIC_NANGO_PUBLIC_KEY! });

const connectGoogle = () => {
  nangoFrontend.openConnectUI({
    onEvent: (event) => {
      if (event.type === 'connect') {
        // Save connection reference to our Integration table
        fetch('/api/integrations', {
          method: 'POST',
          body: JSON.stringify({
            provider: 'google-drive',
            nangoConnectionId: event.connectionId,
          }),
        });
      }
    },
  });
};
```

### Per-Source Ingestion Strategy

| Source | Nango Integration | Sync Method | Data Extracted | Webhook/Event |
|---|---|---|---|---|
| **Google Drive** | `google-drive` via Nango | Scheduled sync (every 30 min) + push notifications | File metadata, content (Docs/Sheets as text) | Drive API push notifications via Nango |
| **Google Docs** | `google-docs` via Nango | On file change event | Full document text content | Via Google Drive watch |
| **Google Sheets** | `google-sheets` via Nango | On file change event | Sheet data as structured JSON | Via Google Drive watch |
| **Linear** | `linear` via Nango | Webhook (real-time) | Issues, comments, project updates, cycle data | Linear native webhooks — supports Issues, Comments, Projects, Cycles, Labels (Source: linear.app/developers/webhooks) |
| **Discord** | `discord` via Nango or direct Discord.js | Real-time event listener | Messages, threads, reactions | Discord Gateway events |
| **Granola** | Direct (not in Nango) | `granola-webhook` daemon or Zapier bridge | Meeting notes, transcripts, attendees, action items | Local file system watcher on cache-v3.json (Source: github.com/owengretzinger/granola-webhook) |
| **Uploaded Files** | N/A | Manual upload via UI | DOCX/PDF/TXT content extraction | Drag-and-drop upload |

### Granola Integration Detail

Granola has three integration paths, each with different tradeoffs:

1. **Official Enterprise API** (Best, but requires Enterprise plan): "Provides programmatic access to workspace meeting notes. API access is available to workspace administrators on the Enterprise plan." (Source: docs.granola.ai/introduction)

2. **granola-webhook daemon** (Recommended for P1): Open-source daemon that "monitors Granola's local cache file and sends HTTP webhooks whenever new notes or transcripts are created, with real-time monitoring via file system events, reliable delivery with automatic retries and exponential backoff." Reads directly from `cache-v3.json`. (Source: github.com/owengretzinger/granola-webhook)

3. **Reverse-engineered API** (Fallback): The `get-documents` endpoint works with a Bearer token found in the local `supabase.json` credential file at `Library/Application Support/Granola/supabase.json`. (Source: josephthacker.com/hacking/2025/05/08/reverse-engineering-granola-notes.html, github.com/getprobo/reverse-engineering-granola-api)

4. **Zapier webhook bridge**: Granola has native Zapier integration with triggers like "Note Added to Granola Folder." Route through Zapier → webhook → Layers. (Source: zapier.com/apps/granola/integrations/webhook)

**Decision: Use the granola-webhook daemon for P1** (runs locally, real-time, no Enterprise plan needed). Plan migration to official API when scaling to external teams.

### Linear Webhook Detail

Linear webhooks are production-ready and well-documented:

- Supports data change events for "Issues, Comments, Issue attachments, Documents, Emoji reactions, Projects, Project updates, Cycles, Labels, Users and Issue SLAs" (Source: linear.app/docs/api-and-webhooks)
- HMAC-SHA256 signature verification for security (Source: linear.app/developers/webhooks)
- Rate limits: 1,500 requests/hour per user with API key auth (Source: rollout.com/integration-guides/linear/api-essentials)
- Full GraphQL API for querying additional data (Source: linear.app/developers)

## Registry Pipeline: The Context Processing Engine

The registry pipeline is the core intelligence layer. Every piece of content that enters Layers passes through this pipeline.

### Pipeline Architecture

```
Raw Content (from any source)
    │
    ▼
┌─────────────────────────┐
│  Step 1: INGEST          │  < 2 seconds
│  Store raw content       │  Create ContextItem (status: 'pending')
│  Show in inbox as new    │  Visible immediately
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Step 2: EXTRACT         │  10-30 seconds
│  generateObject() with   │  Model: gpt-4o-mini
│  ExtractionSchema        │  Output: entities JSON
│  Generate descriptions   │  (short, long, summary)
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Step 3: EMBED           │  2-5 seconds
│  embed() on              │  Model: text-embedding-3-small
│  descriptionLong         │  Output: 1536-dim vector
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Step 4: LINK            │  5-10 seconds
│  Match to sessions       │  generateObject() for matching
│  Match to team members   │  Create SessionContextLinks
│  Generate inbox items    │  Create InboxItems for action items
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Step 5: SURFACE         │  Immediate
│  Status → 'ready'        │  Inbox items visible
│  Session agents notified │  Available for chat queries
└─────────────────────────┘

Total pipeline: < 60 seconds
```

### Why Progressive Context Loading

The multi-level description approach (descriptionShort → descriptionLong → rawContent) is backed by research on context engineering:

- "Selective context injection — where intelligent agents employ retrieval-augmented patterns that fetch only semantically relevant fragments — reduces token consumption by 60-80% while improving accuracy" (Source: devops.com — Context Engineering is the Key to Unlocking AI Agents)
- This avoids the "Dumb RAG" anti-pattern where "everything is dumped into context" — identified as one of three traps that kill agent pilots in production (Source: composio.dev/blog/why-ai-agent-pilots-fail)
- Foundation Capital's thesis on "context graphs" argues "the next trillion-dollar platforms will be built by capturing decision traces that make data actionable" — Layers' Compound step (archiving decisions back into context) follows this pattern (Source: foundationcapital.com/context-graphs-ais-trillion-dollar-opportunity)

## Sprint Plan

### Sprint 1 (Weeks 1-2): Foundation + Context Library

**Goal:** Data goes in, gets stored, and can be browsed.

**Features:**
- Set up Next.js project with Supabase, Vercel AI SDK, AI Elements
- Implement ContextItem data model with pgvector extension enabled
- Build the registry pipeline (Steps 1-3: ingest → extract → embed) as Edge Functions
- Create basic context library browser UI (ContextGrid, ContextCard, SourceBadge)
- Manual file upload working (drag-and-drop DOCX/PDF/TXT)
- Supabase RLS policies for multi-tenant isolation

**Key decisions:** Finalize Zod extraction schema based on real data samples. Test pgvector HNSW index performance with 100-500 items.

**Deliverable:** Upload a meeting transcript, see it processed into structured metadata, browse it in the library.

### Sprint 2 (Weeks 3-4): Integrations + Chat

**Goal:** External data flows in automatically. Users can ask questions.

**Features:**
- Nango integration: Google Drive, Linear, Discord connections
- Granola webhook daemon setup and ingest route
- Nango Connect UI embedded in integrations page
- Build hybrid search (pgvector + full-text + metadata)
- Chat interface with useChat hook and streamText
- Context-aware chat with search tools (agent can query the library)
- Source citations in chat responses

**Key decisions:** Nango sync frequency per provider. Chat system prompt tuning for answer quality vs. hallucination.

**Deliverable:** Connect Google Drive + Linear. Ask "what are our open issues?" and get an answer sourced from Linear data. Ask "summarize yesterday's meeting" and get a response from Granola transcript.

### Sprint 3 (Weeks 5-6): Inbox + Sessions + Team

**Goal:** The product is usable daily by 3 people.

**Features:**
- Inbox view as landing page (InboxList, InboxItem, InboxFilters)
- Inbox generation via cron (morning digest)
- Pipeline Step 4 (Link) — auto-match content to sessions and team members
- Session workspaces with scoped chat
- Create/manage sessions UI
- Team member invitations and org management
- Action item tracking (extracted from meetings, linked to inbox)
- "What's overdue across all projects?" query working

**Key decisions:** Inbox item relevance threshold. Session agent polling interval. Action item deduplication logic.

**Deliverable:** Open Layers in the morning, see prioritized inbox. Click into a session, ask questions scoped to that project. All 3 team members actively using it.

## Technical Risks & Mitigations

### Risk 1: Extraction Quality (HIGH probability, HIGH impact)

**What could go wrong:** The generateObject extraction pipeline produces inconsistent or low-quality entity extraction, especially on messy meeting transcripts with crosstalk, tangents, and ambiguous action items.

**Mitigation:** 
- Use gpt-4o-mini for extraction (fast iteration, cheap to test extensively)
- Build an eval set: 20 real meeting transcripts with manually annotated entities
- Run evals before each schema change
- Implement human-in-the-loop correction in the inbox (user can edit extracted action items)
- Progressive improvement: corrected extractions become few-shot examples

### Risk 2: Granola Integration Fragility (MEDIUM probability, MEDIUM impact)

**What could go wrong:** The granola-webhook daemon relies on Granola's local cache file format, which could change with any Granola update. The reverse-engineered API could be locked down.

**Mitigation:**
- Pin Granola app version during P1 development
- Monitor the granola-webhook GitHub repo for updates
- Build the ingestion interface abstractly so swapping from daemon → official API → Zapier is a configuration change, not a rewrite
- Evaluate Granola Enterprise plan cost if the official API provides more stability

### Risk 3: Team Adoption (MEDIUM probability, HIGH impact)

**What could go wrong:** The other 2 team members don't find enough value to open Layers daily, reverting to their existing workflows.

**Mitigation:**
- The inbox must deliver value on day one — surface things they'd otherwise miss
- Integrate into existing habits: morning Layers check → replaces scattered tool checking
- Measure daily active use per person from Sprint 3 onward
- Weekly feedback sessions to identify friction points
- If inbox quality is poor, fall back to "chat as primary value" — the ability to ask questions across all tools is independently valuable

### Risk 4: Search Quality (MEDIUM probability, MEDIUM impact)

**What could go wrong:** Hybrid search returns irrelevant results, making the chat interface feel broken.

**Mitigation:**
- Implement Reciprocal Rank Fusion (RRF) to combine vector and full-text results
- Tune the balance between semantic similarity and keyword match
- Use the multi-level description system: search against descriptionLong first (higher signal), fall back to rawContent
- Add user feedback mechanism (thumbs up/down on search results) to build evaluation data

### Risk 5: Nango Dependency (LOW probability, MEDIUM impact)

**What could go wrong:** Nango's free tier hits limits, their service has outages, or their pricing changes unfavorably.

**Mitigation:**
- Nango is open source (Elastic license) — can self-host if needed
- The integration layer is abstracted behind our Integration model — swapping Nango for direct API calls or Composio is possible
- For P1 with 3 users, free tier limits are unlikely to be reached
- Keep direct webhook handlers as fallback for critical integrations (Linear, Granola)

## Development Environment Setup

### Prerequisites

```bash
# Required
node >= 20
pnpm >= 8
```

### Environment Variables

```bash
# .env.local

# Supabase (already configured from Gateway)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Vercel AI Gateway
AI_GATEWAY_API_KEY=your-gateway-key

# Nango
NANGO_SECRET_KEY=your-nango-secret-key
NEXT_PUBLIC_NANGO_PUBLIC_KEY=your-nango-public-key

# Stripe (already configured from Gateway)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# Granola Webhook (for daemon setup)
GRANOLA_WEBHOOK_URL=http://localhost:3000/api/context/ingest
GRANOLA_WEBHOOK_TOKEN=your-secret-token

# Optional: Discord Bot (if using direct integration instead of Nango)
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_GUILD_ID=your-server-id
```

### Setup Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd layers-platform
pnpm install

# 2. Set up Supabase
# Enable pgvector extension in Supabase dashboard: Extensions → pgvector → Enable
# Run migrations: pnpm db:migrate

# 3. Set up Nango
# Sign up at nango.dev (free, no credit card)
# Configure integrations: Google Drive, Linear, Discord
# Copy keys to .env.local

# 4. Set up Granola webhook daemon (optional, for P1)
# npm install -g granola-webhook
# granola-webhook init
# Edit ~/.config/granola-webhook/config.json with your webhook URL
# granola-webhook start

# 5. Run
pnpm dev
```

## References & Research Sources

### Architecture Decisions
- pgvector vs Pinecone benchmarks: supabase.com/blog/pgvector-vs-pinecone
- pgvector 2026 benchmark: geetopadesha.com/vector-search-in-2026-pinecone-vs-supabase-pgvector-performance-test
- Confident AI migration: confident-ai.com/blog/why-we-replaced-pinecone-with-pgvector
- Timescale 50M vector benchmark: tigerdata.com/blog/pgvector-vs-pinecone
- Next.js monolith guide: dev.to — Ultimate Guide to Software Architecture in Next.js
- 2025 monolith consensus: foojay.io/today/monolith-vs-microservices-2025
- Next.js as modern monolith: medium.com — NextJS: The Monolith We Now Love
- Monolith cost advantage: strapi.io — Monolithic Architecture Guide

### Integration & MCP
- MCP specification: modelcontextprotocol.io/specification/2025-11-25
- MCP ecosystem growth: guptadeepak.com — Complete Guide to MCP Enterprise Adoption
- MCP November 2025 release: blog.modelcontextprotocol.io — First MCP Anniversary
- Nango platform: nango.dev, github.com/NangoHQ/nango
- Nango documentation: nango.dev/docs/getting-started/intro-to-nango
- Nango vs alternatives: composio.dev/blog/nango-alternatives-ai-agents
- Composio platform: composio.dev, github.com/ComposioHQ/composio
- Agent integration patterns: composio.dev/blog/apis-ai-agents-integration-patterns

### Data Sources
- Granola Enterprise API: docs.granola.ai/introduction
- Granola webhook daemon: github.com/owengretzinger/granola-webhook
- Granola reverse-engineered API: josephthacker.com, github.com/getprobo/reverse-engineering-granola-api
- Granola Zapier integration: zapier.com/apps/granola/integrations/webhook
- Linear webhooks: linear.app/developers/webhooks, linear.app/docs/api-and-webhooks
- Linear API essentials: rollout.com/integration-guides/linear/api-essentials

### Context & Agent Architecture
- Context engineering for agents: devops.com — Context Engineering is the Key to Unlocking AI Agents
- Context management category: datahub.com/blog/context-management
- Context graphs thesis: foundationcapital.com/context-graphs-ais-trillion-dollar-opportunity
- AI agent registry patterns: truefoundry.com/blog/ai-agent-registry
- Agent pilot failure modes: composio.dev/blog/why-ai-agent-pilots-fail
- Agent Name Service proposal: theregister.com — ANS proposal

### 3D / Easel (Post-P1)
- React Three Fiber: r3f.docs.pmnd.rs
- R3F Rapier physics: github.com/pmndrs/react-three-rapier
- R3F ecosystem: r3f.docs.pmnd.rs/getting-started/introduction

### Vercel AI SDK
- AI SDK docs: ai-sdk.dev/docs/introduction
- AI Gateway: vercel.com/ai-gateway
- AI Elements: elements.ai-sdk.dev
