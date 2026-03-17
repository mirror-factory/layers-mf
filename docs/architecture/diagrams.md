# Context Engineering — Architecture Diagrams

## 1. Content Flow (Current → Target)

```
                          ┌──────────────────────────────────────────┐
                          │           EXTERNAL SOURCES               │
                          ├──────┬──────┬──────┬──────┬──────┬──────┤
                          │Drive │Linear│Slack │Discord│GitHub│Granola│
                          └──┬───┴──┬───┴──┬───┴──┬───┴──┬───┴──┬───┘
                             │      │      │      │      │      │
                             ▼      ▼      ▼      ▼      ▼      ▼
                    ┌─────────────────────────────────────────────────┐
                    │              NANGO (Auth + Sync)                │
                    │  ┌─────────┐  ┌──────────┐  ┌───────────────┐  │
                    │  │  OAuth  │  │   Sync   │  │    Proxy      │  │
                    │  │ Manager │  │  Engine  │  │ (raw API)     │  │
                    │  └─────────┘  └────┬─────┘  └───────────────┘  │
                    └────────────────────┼────────────────────────────┘
                                        │ webhook
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        LAYERS INGESTION                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  CHANGE DETECTION                                            │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐  │   │
│  │  │  Content   │  │   Field     │  │   Mutability         │  │   │
│  │  │  Hash      │  │   Diff      │  │   Classifier         │  │   │
│  │  │  (SHA-256) │  │   (metadata)│  │   (immutable/stream/ │  │   │
│  │  │            │  │             │  │    mutable)           │  │   │
│  │  └──────┬─────┘  └──────┬──────┘  └──────────┬───────────┘  │   │
│  │         └───────────┬───┘                     │              │   │
│  └─────────────────────┼─────────────────────────┼──────────────┘   │
│                        ▼                         ▼                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  DECISION ROUTER                                            │    │
│  │                                                             │    │
│  │  Same hash + same metadata ──→ SKIP (save credits)          │    │
│  │  Same hash + diff metadata ──→ UPDATE METADATA ONLY         │    │
│  │  Different hash ─────────────→ FULL RE-PROCESS              │    │
│  │  New source_id ──────────────→ INSERT + PROCESS             │    │
│  │  Append-only stream ─────────→ APPEND TO WINDOW             │    │
│  └──────────────┬───────────────────────────────────────────────┘   │
│                 │                                                   │
│                 ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  VERSION (before update)                                    │    │
│  │  INSERT INTO context_item_versions (old state)              │    │
│  │  change_type, changed_fields, changed_by                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     INNGEST PIPELINE (async)                        │
│                                                                     │
│  Step 1: Fetch item                                                │
│      ↓                                                             │
│  Step 2: AI Extraction (Claude Haiku)                              │
│      │   → title, descriptions, entities, sentiment                │
│      ↓                                                             │
│  Step 3: Content-Type-Specific Chunking                            │
│      │   ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐    │
│      │   │  Prose   │ │   Code   │ │   Chat    │ │  Issue   │    │
│      │   │ semantic │ │   AST    │ │ turn-grp  │ │ whole-doc│    │
│      │   │ heading  │ │ function │ │ 5-10 msgs │ │ if small │    │
│      │   └──────────┘ └──────────┘ └───────────┘ └──────────┘    │
│      ↓                                                             │
│  Step 4: Embed chunks (Voyage 3.5 / text-embedding-3-small)       │
│      ↓                                                             │
│  Step 5: Embed full item (backward compat)                         │
│      ↓                                                             │
│  Step 6: Create inbox items (action items, decisions)              │
│      ↓                                                             │
│  Step 7: Auto-link to sessions (AI matching)                       │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        STORAGE (Supabase)                           │
│                                                                     │
│  ┌─────────────────────────────────────────────┐                   │
│  │  context_items (current, hot)               │                   │
│  │  ├─ raw_content (source truth)              │                   │
│  │  ├─ embedding (vector 1536d, HNSW index)    │                   │
│  │  ├─ search_tsv (GIN index, full-text)       │                   │
│  │  ├─ entities, descriptions (AI-derived)     │                   │
│  │  ├─ user_title, user_notes, user_tags       │                   │
│  │  ├─ trust_weight (relevance multiplier)     │                   │
│  │  └─ content_hash, version_number            │                   │
│  └────────────────────┬────────────────────────┘                   │
│                       │ 1:N                                        │
│  ┌────────────────────┴────────────────────────┐                   │
│  │  context_chunks (search targets)            │                   │
│  │  ├─ content (~400 tokens, embedded)         │                   │
│  │  ├─ parent_content (~1500 tokens, LLM ctx)  │                   │
│  │  └─ embedding (vector 1536d, HNSW index)    │                   │
│  └─────────────────────────────────────────────┘                   │
│                       │ 1:N                                        │
│  ┌────────────────────┴────────────────────────┐                   │
│  │  context_item_versions (cold, append-only)  │                   │
│  │  ├─ title, raw_content, source_metadata     │                   │
│  │  ├─ content_hash                            │                   │
│  │  ├─ change_type, changed_fields, changed_by │                   │
│  │  └─ NO embeddings (saves ~6KB per version)  │                   │
│  └─────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     RETRIEVAL PIPELINE                               │
│                                                                     │
│  User query                                                        │
│      ↓                                                             │
│  Query expansion (3-5 variants via LLM)                            │
│      ↓                                                             │
│  ┌────────────────────────┬────────────────────────┐               │
│  │  BM25 keyword search   │  Vector similarity     │               │
│  │  (PostgreSQL tsvector)  │  (pgvector HNSW)       │               │
│  └────────────┬───────────┴────────────┬───────────┘               │
│               └──────────┬─────────────┘                           │
│                          ▼                                         │
│  RRF merge (k=60) → top 100 candidates                            │
│                          ▼                                         │
│  Apply weights:                                                    │
│    × trust_weight (per item)                                       │
│    × freshness_decay (content-type-specific)                       │
│    × user_boost (interaction signals)                              │
│                          ▼                                         │
│  Cohere Rerank v4 → top 20                                        │
│                          ▼                                         │
│  Return with parent_content + citations                            │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Message Stream Architecture (Slack/Discord)

```
CURRENT (lossy):
  Channel "general" → 1 context_item → overwrites every sync → old messages lost

TARGET (rolling windows):
  Channel "general"
    ├─ "slack-C123-2026-W10" (closed, processed, searchable)
    ├─ "slack-C123-2026-W11" (closed, processed, searchable)
    ├─ "slack-C123-2026-W12" (closed, processed, searchable)
    └─ "slack-C123-2026-W13" (current, appending, re-processed on close)

  Weekly cron (Inngest):
    1. Check if current window is > 7 days old
    2. If yes: close it (set status=ready, full extract+embed)
    3. Open new window for current week
    4. Append new messages to current window only
```

## 3. User Interaction Model

```
┌─────────────────────────────────────────────────────┐
│                  SOURCE TRUTH LAYER                  │
│  (managed by sync — overwritten on updates)          │
│                                                      │
│  title · raw_content · description_short/long        │
│  entities · source_metadata · content_hash           │
└──────────────────────┬──────────────────────────────┘
                       │ never overwrites ↓
┌──────────────────────┴──────────────────────────────┐
│                  USER TRUTH LAYER                    │
│  (managed by users — NEVER overwritten by sync)      │
│                                                      │
│  user_title · user_notes · user_tags                 │
│  trust_weight · pinned/starred                       │
│  feedback signals · interaction history              │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                  DISPLAY LOGIC                       │
│                                                      │
│  Show: user_title ?? title                           │
│  Show: description_long + user_notes (if any)        │
│  Tags: entities.topics + user_tags (merged)          │
│  Weight: trust_weight (user override > org default)  │
└─────────────────────────────────────────────────────┘
```

## 4. Mutability Decision Tree

```
New content arrives from source
  │
  ├─ Has source_id? ──── No ──→ Upload/API: INSERT, no dedup
  │
  ├─ Exists in DB? ──── No ──→ INSERT + version(created) + process
  │
  └─ Exists in DB? ──── Yes ──→ Compute content_hash
                                  │
                                  ├─ Hash same + metadata same ──→ SKIP
                                  │
                                  ├─ Hash same + metadata diff ──→ Version(metadata_updated)
                                  │                                Update metadata only
                                  │                                Do NOT re-embed
                                  │
                                  └─ Hash different ──→ Is this append-only content?
                                                        │
                                                        ├─ Yes (Slack/Discord) ──→ Append to window
                                                        │                          Re-process on close
                                                        │
                                                        └─ No (Doc/Issue) ──→ Version(content_updated)
                                                                              Update all fields
                                                                              Re-extract + re-embed
```
