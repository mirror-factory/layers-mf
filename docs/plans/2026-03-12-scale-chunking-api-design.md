# Layers Scale, Chunking & API/MCP Design

**Date:** 2026-03-12
**Status:** Approved
**Author:** Alfonso Morales + Claude (CTO)

## Problem Statement

Layers currently stores one embedding per document (truncated to 8k chars). At scale (20-100 users, 50k-100k+ docs), this causes:

1. **Information loss** — Long documents invisible after page 3-4
2. **No dedup** — Integration syncs create duplicate context_items
3. **No retry/observability** — Fire-and-forget processing with no error recovery
4. **Index degradation** — Single HNSW index scans all orgs
5. **No external API** — Other AI tools can't access Layers data

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Chunking strategy | Parent-child (400-token child, 1500-token parent) | Search precision + LLM context quality |
| Job queue | Inngest (event-driven durable functions) | Managed, retries, fits Next.js/Vercel stack |
| Sync pattern | Webhook-first + upsert + daily reconciliation | Industry standard (Glean/Dust pattern) |
| Vector partitioning | LIST partition by org_id with per-partition HNSW | Multi-tenant performance at scale |
| API auth | Per-user API keys, scoped to org | Simple, standard for MCP |
| MCP transport | HTTP SSE (remote server) | No local install needed |

---

## 1. Data Model: context_chunks

New table — each document produces N chunks, each with its own embedding.

```sql
CREATE TABLE context_chunks (
  id uuid DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  context_item_id uuid NOT NULL REFERENCES context_items(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,           -- ~400 tokens (~1600 chars)
  parent_content text NOT NULL,    -- ~1500 tokens (~6000 chars)
  metadata jsonb DEFAULT '{}',     -- section heading, page number, etc.
  embedding vector(1536),
  search_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', content)
  ) STORED,
  PRIMARY KEY (org_id, id)
) PARTITION BY LIST (org_id);
```

### Changes to context_items

- Add `content_hash text` — sha256 of raw_content for change detection
- Add unique constraint: `UNIQUE (org_id, source_type, source_id)` for upsert/dedup
- Keep existing `embedding` column during transition, remove after backfill

### Search Changes

- Hybrid search (RRF) runs against `context_chunks` instead of `context_items`
- Returns `parent_content` to the LLM (bigger context window)
- Deduplicates results by `context_item_id` — max 2 chunks per document in results
- Existing search function remains as fallback during migration

---

## 2. Processing Pipeline (Inngest)

Replace fire-and-forget with durable multi-step pipeline.

```
Event: "context/item.created"
  │
  ├─ Step 1: Parse & Validate
  │   - Extract raw text
  │   - Upsert context_item on (org_id, source_type, source_id)
  │   - Skip if content_hash unchanged
  │   - Set status='processing'
  │
  ├─ Step 2: Extract Metadata
  │   - Claude Haiku → title, summary, entities
  │   - Update context_item
  │
  ├─ Step 3: Chunk
  │   - Split raw_content into ~400-token children
  │   - Generate ~1500-token parent windows
  │   - Delete old chunks if re-processing
  │   - Insert context_chunks (no embeddings yet)
  │
  ├─ Step 4: Embed (batch)
  │   - Batch embed all chunks (OpenAI batch API, up to 2048)
  │   - Update each chunk with embedding + search_tsv
  │
  ├─ Step 5: Link to Sessions
  │   - Score chunks against active sessions
  │   - Create session_context_links for score ≥ 0.5
  │
  └─ Step 6: Finalize
      - Set status='ready'
      - Create inbox items
      - Emit "context/item.ready"
```

Each step is independently retryable. If embedding fails (rate limit), only Step 4 retries.

### Concurrency Controls

- Max 10 parallel pipeline executions per org
- Max 5 concurrent OpenAI embedding batches globally
- Configurable via Inngest function options

---

## 3. Integration Sync Pattern

Same pattern for all integrations.

### Webhook Flow

```
Webhook arrives → Verify signature → Respond 200 → Emit Inngest event

Inngest "integration/webhook.received":
  Step 1: Fetch canonical state from source API
  Step 2: Upsert context_item (compare content_hash)
  Step 3: If changed → trigger processing pipeline
```

### Upsert Logic

```sql
INSERT INTO context_items (org_id, source_type, source_id, title, raw_content, content_hash, ...)
ON CONFLICT (org_id, source_type, source_id)
DO UPDATE SET
  title = EXCLUDED.title,
  raw_content = EXCLUDED.raw_content,
  content_hash = EXCLUDED.content_hash,
  status = 'processing',
  ingested_at = now()
WHERE context_items.content_hash IS DISTINCT FROM EXCLUDED.content_hash;
```

Skip processing entirely if content hasn't changed.

### Daily Reconciliation (Inngest Cron)

```
Cron: "0 3 * * *" (3 AM daily)

For each active integration per org:
  - Fetch all items from source API (paginated)
  - Compare against existing context_items by source_id
  - Upsert missing or changed items
  - Archive items deleted at source
```

### Per-Integration Notes

| Integration | Webhook Events | Reconciliation |
|-------------|---------------|----------------|
| Google Drive | Push notifications (24h expiry, auto-renew via Inngest cron) | Full change list via startPageToken |
| Linear | Issue, Comment, Project, Cycle events | GraphQL paginated query (50/page, max 500) |
| Discord | Message create/update via bot | Fetch recent messages per channel |
| GitHub | Push, PR, Issue events | REST API paginated fetch |
| Slack | Events API (message, file) | Conversations.history paginated |

---

## 4. Vector Partitioning

### Partition Strategy

LIST partition `context_chunks` by `org_id`. Each org gets:
- Its own table partition
- Its own HNSW index (only searches that org's vectors)
- Its own GIN index for full-text search

### Auto-Partition Management

When a new org is created, emit Inngest event → create partition + indexes:

```sql
CREATE TABLE context_chunks_<org_short_id>
  PARTITION OF context_chunks FOR VALUES IN ('<org_uuid>');

CREATE INDEX ON context_chunks_<org_short_id>
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX ON context_chunks_<org_short_id>
  USING gin (search_tsv);
```

### Performance Expectations

| Org Size | Chunks | Index Type | Search Latency |
|----------|--------|-----------|---------------|
| Small (<1k docs) | ~10k | Exact NN | <50ms |
| Medium (1k-10k docs) | ~100k | HNSW | <100ms |
| Large (10k-50k docs) | ~500k | HNSW | <200ms |

---

## 5. API / MCP Server

### Public REST API

```
POST /api/v1/search        → Hybrid search across user's context
GET  /api/v1/context        → List documents (paginated, filtered)
GET  /api/v1/context/:id    → Get document detail with chunks
```

### MCP Server (HTTP SSE)

```
Tool: search_context    → Same as POST /api/v1/search
Tool: list_documents    → Same as GET /api/v1/context
Tool: get_document      → Same as GET /api/v1/context/:id
Resource: context://docs → Browseable document list
```

### Auth: API Keys

```sql
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  org_id uuid NOT NULL REFERENCES organizations(id),
  key_hash text NOT NULL,          -- sha256 of the actual key
  key_prefix text NOT NULL,        -- first 8 chars for identification
  name text NOT NULL,              -- user-friendly label
  scopes text[] DEFAULT '{read}',  -- 'read', 'write', 'admin'
  rate_limit int DEFAULT 100,      -- requests per minute
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

- Keys displayed once on creation (like GitHub PATs)
- Prefix shown in settings for identification
- Rate limited per key (default 100 req/min)
- Manageable from Settings > API Keys page

### MCP Transport

HTTP SSE (Streamable HTTP) — the 2025 MCP standard for remote servers. Users add the Layers MCP endpoint URL + API key in their AI tool settings. No local install.

---

## 6. Implementation Phases

| Phase | What | Depends On | Effort |
|-------|------|-----------|--------|
| **1** | Inngest setup + upsert/dedup | Nothing | 1 day |
| **2** | Chunking pipeline + context_chunks table | Phase 1 | 2 days |
| **3** | New hybrid search on chunks | Phase 2 | 1 day |
| **4** | Backfill existing 93 docs | Phase 3 | Half day |
| **5** | Partitioning by org_id | Phase 3 | 1 day |
| **6** | API/MCP server + api_keys | Phase 3 | 2 days |
| **7** | Daily reconciliation cron | Phase 1 | 1 day |
| **8** | Settings UI for API keys | Phase 6 | Half day |

Phases 5, 6, 7 are independent after Phase 3 — can run in parallel.

**Total estimated effort: ~8-9 days**

---

## Cost Projections

### Embedding Costs (text-embedding-3-small)

| Scale | Documents | Chunks (~10/doc) | Tokens | Cost |
|-------|-----------|-------------------|--------|------|
| Current | 93 | ~930 | ~465k | < $0.01 |
| 1k docs | 1,000 | ~10k | ~5M | ~$0.10 |
| 10k docs | 10,000 | ~100k | ~50M | ~$1.00 |
| 100k docs | 100,000 | ~1M | ~500M | ~$10.00 |

### Extraction Costs (Claude Haiku)

| Scale | Documents | Cost |
|-------|-----------|------|
| 1k docs | 1,000 | ~$0.50 |
| 10k docs | 10,000 | ~$5.00 |
| 100k docs | 100,000 | ~$50.00 |

### Inngest

- Free tier: 5,000 runs/month
- Pro: $50/month for 50k runs
- At 100k docs: ~700k runs for initial backfill, then proportional to new content

### Storage (Supabase)

- 1M chunks × 1536 dims × 4 bytes = ~6 GB vector storage
- Well within Supabase Pro plan limits

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Inngest vendor lock-in | Pipeline logic is in our functions; swap to Trigger.dev or pg-boss if needed |
| Partition management complexity | Automate via Inngest event on org creation; start with manual for first 10 orgs |
| Chunking quality varies by doc type | Start with recursive character splitting; graduate to semantic if metrics show need |
| OpenAI embedding rate limits | Inngest concurrency controls + exponential backoff built-in |
| Migration downtime | Dual-write during transition; old search works until cutover |
