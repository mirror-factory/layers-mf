# Context Engineering Architecture

> **Created:** 2026-03-17
> **Author:** Claude (CTO Agent) — synthesized from 4-agent research team
> **Status:** Research complete, ready for review
> **Purpose:** Define how Layers handles all content types — ingestion, versioning, embedding, retrieval, user interaction, and lifecycle management

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Content Type Taxonomy](#content-type-taxonomy)
3. [Mutability Model](#mutability-model)
4. [Storage Architecture](#storage-architecture)
5. [Versioning System](#versioning-system)
6. [Chunking Strategy](#chunking-strategy)
7. [Embedding & Retrieval Pipeline](#embedding--retrieval-pipeline)
8. [User Interaction Layer](#user-interaction-layer)
9. [Content Lifecycle](#content-lifecycle)
10. [UX Patterns](#ux-patterns)
11. [Migration Plan](#migration-plan)
12. [Competitive Landscape](#competitive-landscape)

---

## 1. Executive Summary

Layers ingests content from many sources with fundamentally different natures — a Linear issue changes status hourly, a Google Doc evolves over weeks, a Slack message is immutable once sent, and a meeting transcript is frozen after the meeting ends.

**Our current architecture treats all content the same:** one mutable row per source item, overwritten on every sync, no history, no versioning, no user annotations. This is wrong.

**This document defines the target architecture** that handles content according to its nature — versioning mutable content, appending stream content, preserving user edits separately from source truth, and giving users control over relevance weighting.

### Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Version storage | Separate `context_item_versions` table | Current table stays fast; history is cold/append-only |
| What to version | Raw content + title + metadata only | AI extractions are derived — regenerate on demand |
| Embedding versioning | No — always embed current version | Too expensive; historical search is rare |
| Message streams | Weekly rolling windows per channel | Prevents data loss without per-message overhead |
| User edits | Overlay columns on `context_items` | Never overwritten by sync; separate from source truth |
| Chunking | Content-type-specific strategies | Code needs AST chunking; prose needs semantic splitting |
| Reranking | Add Cohere Rerank after RRF | 10+ nDCG point improvement on benchmarks |
| Embedding model | Evaluate Voyage 3.5 (current: text-embedding-3-small) | Better quality, Matryoshka support, lower cost |

---

## 2. Content Type Taxonomy

### Current vs Target

| Category | Current `content_type` values | Target expansion |
|----------|-------------------------------|------------------|
| Documents | `document` | `document`, `spreadsheet`, `design_spec` |
| Code | — | `pull_request`, `commit`, `code_review`, `error_log` |
| Communication | `message` | `message`, `email_thread`, `comment` |
| Meetings | `meeting_transcript` | `meeting_transcript`, `calendar_event`, `meeting_notes` |
| Project Mgmt | `issue` | `issue`, `sprint`, `epic` |
| Knowledge Base | — | `support_ticket`, `feedback`, `help_article` |
| Media | — | `media_transcript`, `image` |
| External | — | `web_page`, `api_payload` |

### Content Nature Matrix

```
                    IMMUTABLE                    MUTABLE
                    ─────────                    ───────
    SMALL           calendar events              issue metadata
    (< 500 tokens)  NPS scores                   task status
                    webhook payloads             tags/labels

    MEDIUM          email threads                issues + comments
    (500-10K)       support tickets              design specs
                    code reviews                 wiki pages

    LARGE           meeting transcripts          Google Docs
    (10K-100K)      research papers              PRDs / RFCs
                    podcast transcripts          comprehensive reports

    STREAM          Slack messages               —
    (append-only)   Discord messages
                    commit history
```

---

## 3. Mutability Model

Every content type falls into one of four categories. Each requires a different sync strategy:

### Immutable Content
**Examples:** Meeting transcripts, calendar events, webhook payloads, commits, feedback submissions

**Strategy:** Ingest once. Never re-process. Deduplicate by `source_id`. No versioning needed.
```
Source → Ingest → Extract → Embed → Done (never touch again)
```

### Append-Only Streams
**Examples:** Slack messages, Discord messages, email threads, support ticket replies, comment threads

**Strategy:** Time-bucketed windows. Append new messages to current window. Close and process completed windows.
```
Source → Append to current window → When window closes → Extract → Embed
         └─ New window weekly ─────────────────────────┘
```

### Infrequently Mutable
**Examples:** Google Docs, PDFs, design specs, brand guidelines, wiki pages, help articles

**Strategy:** Content-hash change detection. Re-process only when content actually changes. Version on change.
```
Source → Hash → Compare to stored hash → Changed? → Version old → Update → Re-extract → Re-embed
                                        └─ Same? → Skip (save credits)
```

### Frequently Mutable
**Examples:** Linear issues, Jira tickets, PR status, sprint progress, spreadsheet data

**Strategy:** Field-level change detection. Separate metadata updates (status change) from content updates (description rewrite). Only re-embed on content changes.
```
Source → Diff fields → Metadata only? → Update metadata + version → Skip re-embedding
                      └─ Content changed? → Version old → Update → Re-extract → Re-embed
```

---

## 4. Storage Architecture

### Current Schema (simplified)
```
context_items (one mutable row per source item)
  ├── raw_content (overwritten on sync)
  ├── embedding (overwritten on sync)
  ├── entities (overwritten on sync)
  └── content_hash (exists but underutilized)

context_chunks (deleted and regenerated on every update)
  ├── content (~400 token child)
  ├── parent_content (~1500 token parent)
  └── embedding
```

### Target Schema

```
context_items (current version — fast reads, existing queries unchanged)
  ├── raw_content
  ├── embedding (always points to latest)
  ├── entities
  ├── content_hash (sha256, used for change detection)
  ├── version_number (new — increment on update)
  ├── user_title (new — user override, never overwritten by sync)
  ├── user_notes (new — user annotations)
  ├── user_tags (new — user-defined tags)
  ├── trust_weight (new — 0.1 to 2.0, default 1.0)
  ├── freshness_at (new — when source content was last confirmed current)
  └── updated_at (new — when this row was last modified)

context_item_versions (historical — append-only, no embeddings)
  ├── context_item_id → context_items(id) CASCADE
  ├── version_number
  ├── title
  ├── raw_content
  ├── content_hash
  ├── source_metadata
  ├── change_type (created | content_updated | metadata_updated | deleted)
  ├── changed_fields text[] (e.g., ['status', 'assignee'])
  ├── changed_by text (e.g., 'sync:linear', 'user:abc123')
  └── created_at

context_chunks (same structure, regenerated on content changes only)
  ├── content
  ├── parent_content
  ├── embedding
  ├── embedding_model text (new — track which model was used)
  └── embedded_at timestamptz (new — when embedding was computed)
```

### Why This Design

- **`context_items` stays clean** — existing queries, RLS policies, vector indexes, and hybrid search all work unchanged
- **Versions have NO embeddings** — saves ~6KB per version (1536 floats). Embeddings always point to current version.
- **User overlay columns** on `context_items` instead of a separate table — avoids JOIN on every read
- **`trust_weight`** enables per-item relevance boosting without touching the search function
- **`freshness_at`** tracks when we last confirmed the source content is current (separate from `updated_at` which tracks our DB write)

### Storage Projections

| Scenario | Version rows/year | Storage (no embeddings) |
|----------|-------------------|------------------------|
| 1 org, 500 items, 20% change/day | ~36,000 | ~360 MB |
| 10 orgs, 500 items each | ~360,000 | ~3.6 GB |
| 100 orgs, 1000 items each | ~7.2M | ~72 GB |

Manageable. Versions without embeddings are cheap.

---

## 5. Versioning System

### What Gets Versioned (and What Doesn't)

| Data | Version? | Rationale |
|------|----------|-----------|
| `raw_content` | YES | Source truth — must preserve history |
| `title` | YES | Changes meaningfully (issue renamed, doc retitled) |
| `source_metadata` | YES | Contains status, assignee, labels — "what changed?" data |
| `content_hash` | YES | Cheap, enables fast diff detection |
| `description_short/long` | NO | AI-derived — regenerate from raw_content on demand |
| `entities` | NO | AI-derived — regenerate on demand |
| `embedding` | NO | Too expensive (~6KB per version). Always embed current. |
| `context_chunks` | NO | Derived from raw_content — regenerate on demand |
| User edits | YES (separate `changed_by`) | Track who changed what — source vs user |

### Change Detection Flow

```
Incoming sync data
  │
  ├─ Compute content_hash(new_raw_content)
  │
  ├─ Compare to stored content_hash
  │   ├─ SAME hash + SAME metadata → SKIP (no version, no update)
  │   ├─ SAME hash + DIFFERENT metadata → METADATA_UPDATE
  │   │   └─ Version with change_type: 'metadata_updated'
  │   │   └─ Update metadata columns only
  │   │   └─ Do NOT re-embed (content unchanged)
  │   └─ DIFFERENT hash → CONTENT_UPDATE
  │       └─ Version with change_type: 'content_updated'
  │       └─ Update raw_content + metadata
  │       └─ Re-extract + re-chunk + re-embed
  │
  └─ First time seeing this source_id → CREATED
      └─ Insert new context_item
      └─ Version with change_type: 'created'
      └─ Extract + chunk + embed
```

### Message Stream Versioning (Slack/Discord)

Instead of versioning a single mutable channel item, use **weekly rolling windows**:

```
Week 1: context_items.source_id = "slack-C123-2026-W12"
         └─ Messages from March 17-23
         └─ Closed Sunday, fully extracted + embedded

Week 2: context_items.source_id = "slack-C123-2026-W13"
         └─ Messages from March 24-30
         └─ Still appending (current window)

Older windows are immutable, searchable context items.
New messages only append to the current window.
No data loss. No overwrites. Full searchability.
```

---

## 6. Chunking Strategy

### Content-Type-Specific Approach

| Content Type | Strategy | Child Size | Parent Size | Notes |
|-------------|----------|------------|-------------|-------|
| Documents (prose) | Semantic/heading-based | 400-512 tokens | 1500 tokens | Split at H2/H3 boundaries, fallback to paragraph |
| Code | AST-based | Function/class | File-level | tree-sitter parsing; never split mid-function |
| Chat messages | Conversation-turn grouping | 5-10 messages | Full thread | Group by thread; preserve author attribution |
| Issues/tickets | Whole-issue (if < 1500 tokens) | Issue body | Issue + comments | Most issues fit in one chunk |
| Transcripts | Topic-segment based | 400-512 tokens | Full topic segment | Split at speaker/topic changes |
| Spreadsheets | Row-group based | ~50 rows | Full sheet | Preserve header row in every chunk |
| Short items (< 200 tokens) | No chunking | Full item | — | Calendar events, action items, metrics |

### Current vs Target

**Current:** One strategy for everything — ~400 token child, ~1500 token parent, character-boundary splitting.

**Target:** Content-type dispatcher that selects the right chunking strategy:

```
raw_content + content_type
  │
  ├─ content_type = 'issue' && tokens < 1500 → single chunk (no split)
  ├─ content_type = 'message' → conversation-turn grouping
  ├─ content_type = 'meeting_transcript' → topic/speaker segmentation
  ├─ content_type = 'document' → semantic/heading-based splitting
  ├─ source_type = 'github' && is_code → AST-based splitting
  └─ default → current parent-child strategy (works fine as fallback)
```

---

## 7. Embedding & Retrieval Pipeline

### Current Pipeline
```
Query → Embed (text-embedding-3-small, 1536d)
      → Parallel: BM25 + Vector search
      → RRF merge (k=60)
      → Return top results
```

### Target Pipeline
```
Query → Query expansion (3-5 variants via LLM)
      → Embed all variants (Voyage 3.5, 1024d)
      → Parallel per variant:
      │   ├─ BM25 keyword search (existing)
      │   └─ Vector similarity search (existing)
      → RRF merge across all variants (k=60)
      → Apply weights:
      │   ├─ trust_weight (per-item, user/org configurable)
      │   ├─ freshness_decay (content-type-specific)
      │   └─ user_interaction_boost (click-through signals)
      → Cohere Rerank v4 (top 20)
      → Return top 10 with citations
```

### Improvements Over Current

| Improvement | Impact | Effort |
|-------------|--------|--------|
| Query expansion (multi-query) | +15-20% recall | Medium (1 LLM call/query) |
| Cohere Rerank | +10 nDCG points | Low (API call on shortlist) |
| Content-type chunking | Better precision for code/chat | Medium |
| Trust weighting | User-controlled relevance | Low (multiply score × weight) |
| Freshness decay | Deprioritize stale content | Low (time-based multiplier) |
| Voyage 3.5 model | Better quality, Matryoshka dims | Medium (re-embed all content) |

### Embedding Model Comparison

| Model | Dims | MTEB | Cost/MTok | Matryoshka | Best For |
|-------|------|------|-----------|------------|----------|
| text-embedding-3-small (current) | 1536 | 62.3 | $0.02 | Yes | Budget, good quality |
| text-embedding-3-large | 3072 | 64.6 | $0.13 | Yes | Max quality (OpenAI) |
| Voyage 3.5 | 2048 | ~65 | $0.06 | Yes | Best quality/cost ratio |
| voyage-code-3 | 2048 | — | $0.06 | Yes | Code retrieval (+13.8% vs OpenAI) |
| Cohere Embed v4 | 1536 | 65.2 | $0.12 | No | Multimodal, 128K context |

**Recommendation:** Evaluate Voyage 3.5 at 1024 dimensions. If quality matches or exceeds current 3-small at 1536d, switch. Use voyage-code-3 for code content. Keep 3-small as fallback.

### Scaling Path

| Vector Count | Solution | Notes |
|-------------|----------|-------|
| < 1M | pgvector HNSW (current) | Fine for years at current growth |
| 1-50M | pgvector + pgvectorscale | 11.4x perf improvement over base pgvector |
| 50M+ | Evaluate Qdrant/Weaviate | Dedicated vector DB, separate from Supabase |

---

## 8. User Interaction Layer

### Source Trust & Weighting

Users can control how much each source influences search and AI answers:

```
trust_weight: 0.1 (noise) ──── 1.0 (default) ──── 2.0 (authoritative)
```

| Source | Default Weight | Rationale |
|--------|---------------|-----------|
| Linear | 1.5 | Decisions live here; high signal |
| Google Drive | 1.2 | Structured docs, reviewed content |
| GitHub | 1.2 | Authoritative for code |
| Granola | 1.0 | Meeting notes; context |
| Slack | 0.7 | High noise, conversational |
| Discord | 0.7 | Same as Slack |

**Per-item override:** Users can pin (weight → 2.0) or demote (weight → 0.3) individual items.

**Per-org defaults:** Admins set source weights. Users can toggle "use my preferences" for personal overrides.

### User Annotations

Users can add without overwriting source truth:

| Field | Source-managed | User-managed |
|-------|---------------|--------------|
| Title | `title` (AI-extracted, overwritten on sync) | `user_title` (never overwritten) |
| Summary | `description_short` (AI-extracted) | `user_notes` (appended, never overwritten) |
| Tags | `entities.topics` (AI-extracted) | `user_tags` (user-defined) |
| Weight | `trust_weight` default | `trust_weight` overridden |

**Display logic:** Show `user_title ?? title`. Show `user_notes` below `description_long` with "Note by [user]" label.

### Feedback Signals

Track implicitly and explicitly:

| Signal | How | Impact |
|--------|-----|--------|
| Click-through | Log (query, chunk_id, clicked) | Boost chunks with high CTR |
| Dwell time | Track time spent on detail page | Longer = more useful |
| Thumbs up/down on chat | Explicit feedback on AI answers | Boost/penalize cited chunks |
| "Wrong extraction" | User flags AI error | Feed into extraction quality metrics |
| Star/pin | User marks as important | Weight → 2.0 |

---

## 9. Content Lifecycle

### Status Pipeline

```
SYNCING → PENDING → PROCESSING → READY → STALE → ARCHIVED
  ↑                                ↓        ↓
  └── re-sync ─────────────────────┘        └── user restores
```

| Status | Meaning | Visual |
|--------|---------|--------|
| `syncing` | Currently being fetched from source | Spinning icon |
| `pending` | Fetched, waiting for AI pipeline | Clock icon |
| `processing` | AI extraction + embedding running | Gear icon |
| `ready` | Fully processed, searchable | Green check |
| `stale` | Not updated in X days (configurable) | Yellow clock |
| `archived` | Removed from active search, preserved | Gray |
| `error` | Processing failed | Red alert |

### Staleness Thresholds (per content type)

| Content Type | Stale After | Rationale |
|-------------|-------------|-----------|
| Messages (Slack/Discord) | 30 days | Conversations move fast |
| Issues (Linear/GitHub) | 14 days | Status should be current |
| Documents (Drive/Notion) | 90 days | Docs age slowly |
| Meeting transcripts | Never | Immutable historical records |
| Calendar events (past) | Never | Historical facts |
| Calendar events (future) | Event date + 1 day | Irrelevant after the meeting |

### Retention Policy

| Period | Action |
|--------|--------|
| 0-90 days | Keep all versions |
| 90-365 days | Keep every 10th version (thin out intermediate states) |
| > 1 year | Keep creation + final version only |
| Archived items | Keep indefinitely but exclude from search index |

### GDPR Deletion

On deletion request:
1. Delete `context_items` row (CASCADE deletes chunks and versions)
2. Remove from vector index
3. Backups: rely on backup rotation (30-day retention)
4. Future: crypto-shredding for enterprise compliance

---

## 10. UX Patterns

### Search Results

```
┌─────────────────────────────────────────────────────┐
│ 🔍 "what did we decide about pricing?"              │
├─────────────────────────────────────────────────────┤
│ ◆ PROD-145: Pricing Model Decision     [Linear]    │
│   Status: Done · Updated 2d ago · Trust: High      │
│   "We decided on usage-based pricing with three     │
│    tiers: Free (50 credits), Starter..."            │
│   ──────────────────────────────────────── 0.94 ──  │
│                                                     │
│ 📁 Pricing Strategy Q1 2026.docx    [Google Drive]  │
│   Updated 3w ago · Trust: Default                   │
│   "The recommended approach is credit-based with    │
│    monthly reset and carry-over..."                 │
│   ──────────────────────────────────────── 0.87 ──  │
│                                                     │
│ 💬 #product — Slack                   [Slack]       │
│   1w ago · Trust: Context only                      │
│   "alfonso: let's go with 3 tiers, the numbers     │
│    from the spreadsheet make sense..."              │
│   ──────────────────────────────────────── 0.72 ──  │
└─────────────────────────────────────────────────────┘

Facets: [Source ▾] [Type ▾] [Date ▾] [Person ▾] [Status ▾]
```

### Version History View

```
┌─────────────────────────────────────────────────────┐
│ ◆ PROD-145: Pricing Model Decision                  │
│ Version 7 (current) · Updated 2 days ago            │
├─────────────────────────────────────────────────────┤
│ v7  Mar 15  Status: Done      ← status changed     │
│ v6  Mar 14  Status: In Review ← assignee changed    │
│ v5  Mar 12  Content updated   ← description edited  │
│ v4  Mar 10  Status: In Progress                     │
│ v3  Mar 8   Labels: +pricing  ← label added         │
│ v2  Mar 7   Assignee: alfonso                       │
│ v1  Mar 5   Created           ← initial sync        │
│                                                     │
│ [Compare v5 ↔ v7]  [Show full content at v3]        │
└─────────────────────────────────────────────────────┘
```

### Content Health Dashboard

```
┌─────────────────────────────────────────────────────┐
│ 📊 Knowledge Base Health: 78/100                    │
├──────────────┬──────────────┬───────────────────────┤
│ Sources: 6   │ Items: 482   │ Versions: 1,247       │
├──────────────┴──────────────┴───────────────────────┤
│                                                     │
│ Freshness          ████████████░░░░  78% fresh      │
│ Processing Errors  ████████████████  0 errors       │
│ Embedding Coverage ███████████████░  96% embedded   │
│ User Annotations   ███░░░░░░░░░░░░  12 items noted  │
│                                                     │
│ ⚠ 23 items stale (> 90 days) [Review]               │
│ ⚠ 4 items from Slack older than 30 days [Archive?]  │
└─────────────────────────────────────────────────────┘
```

### Source Trust Configuration

```
┌─────────────────────────────────────────────────────┐
│ ⚙ Source Trust Settings                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ◆ Linear          [████████████████░░░░] 1.5x       │
│   "Authoritative — decisions and specs"             │
│                                                     │
│ 📁 Google Drive   [█████████████░░░░░░░] 1.2x       │
│   "Reference — structured documents"                │
│                                                     │
│ ⚙ GitHub          [█████████████░░░░░░░] 1.2x       │
│   "Authoritative — code and technical"              │
│                                                     │
│ 🎙 Granola         [██████████░░░░░░░░░░] 1.0x       │
│   "Default — meeting context"                       │
│                                                     │
│ 💬 Slack           [███████░░░░░░░░░░░░░] 0.7x       │
│   "Context only — conversational"                   │
│                                                     │
│ 🎮 Discord         [███████░░░░░░░░░░░░░] 0.7x       │
│   "Context only — conversational"                   │
│                                                     │
│ [Reset to defaults]              [Save]             │
└─────────────────────────────────────────────────────┘
```

---

## 11. Migration Plan

### Phase 1: Schema Foundation (Sprint 4)
- [ ] Add `version_number`, `updated_at`, `freshness_at` to `context_items`
- [ ] Add `user_title`, `user_notes`, `user_tags`, `trust_weight` to `context_items`
- [ ] Create `context_item_versions` table
- [ ] Add `embedding_model`, `embedded_at` to `context_chunks`

### Phase 2: Change Detection (Sprint 4-5)
- [ ] Implement content_hash computation on ALL sync paths
- [ ] Field-level change detection for metadata-only updates
- [ ] Skip re-embedding when only metadata changes
- [ ] Insert versions before updating context_items

### Phase 3: Message Streams (Sprint 5)
- [ ] Weekly rolling windows for Slack channels
- [ ] Weekly rolling windows for Discord channels
- [ ] Close + process completed windows via Inngest cron

### Phase 4: User Controls (Sprint 5-6)
- [ ] Source trust weighting UI (settings page)
- [ ] User annotation UI (edit title, add notes, add tags)
- [ ] Pin/star system with weight boost
- [ ] Feedback signals (thumbs up/down on chat)

### Phase 5: Advanced Retrieval (Sprint 6-7)
- [ ] Query expansion (multi-query)
- [ ] Cohere Rerank integration
- [ ] Content-type-specific chunking dispatcher
- [ ] Evaluate Voyage 3.5 embedding model

### Phase 6: Lifecycle Management (Sprint 7-8)
- [ ] Staleness detection cron job
- [ ] Content health dashboard
- [ ] Version history UI
- [ ] Retention policy enforcement

---

## 12. Competitive Landscape

| Product | Strengths Layers Should Adopt |
|---------|-------------------------------|
| **Glean** | Knowledge graph (people + projects + sources), personalized ranking by role |
| **Dust.tt** | Granular selective sync (tree-view with checkboxes per folder/channel) |
| **Guru** | Card-based knowledge units with verification workflows and expiry dates |
| **Mem.ai** | Auto-surfacing related content without manual search |
| **Notion AI** | AI database properties (auto-summary, auto-keywords on ingestion) |
| **Onyx/Danswer** | Permission-aware retrieval, 40+ connectors, open-source reference |

### Layers' Differentiation

- **Multi-source AI context** — not just search, but a unified AI layer across all tools
- **Session workspaces** — scoped contexts for project-specific AI conversations
- **Ditto personalization** (planned) — AI that learns per-user preferences
- **Proactive insights** — agent surfaces connections you didn't search for

---

## Appendix: Research Sources

- OpenAI, Voyage AI, Cohere embedding model benchmarks (2025-2026)
- Firecrawl chunking strategy benchmarks (2026)
- VersionRAG paper (arXiv, October 2025) — version-aware retrieval
- Confluence data model (Atlassian) — CONTENT + CONTENT_VERSION pattern
- Outline diff view — document version UI patterns
- Glean enterprise search personalization blog
- Dust.tt data source management documentation
- Event-Driven.io — GDPR in event-driven architecture
- Shape of AI — citation patterns for AI products
- Multiple RAG benchmark papers (2025-2026)

---

## 13. Runtime Context Engineering

This section documents how Layers manages LLM context at runtime — conversation compaction, system prompt caching, priority doc injection, and context window tracking.

### Conversation Compaction

**File:** `src/lib/ai/compaction-middleware.ts`

Compaction is a `LanguageModelMiddleware` applied via `wrapLanguageModel()` in the chat route. It runs on every LLM call via `transformParams` before the request reaches the provider.

**How it works:**

1. Estimate total tokens in the current prompt (system + messages)
2. Compare against threshold (80% of the model's context window)
3. If under threshold: pass through unchanged
4. If over threshold:
   - Separate system messages from conversation messages
   - Keep the last 4 turns intact (KEEP_RECENT_TURNS)
   - Serialize older turns into a plaintext transcript
   - Summarize the transcript using a fast model (Gemini Flash Lite)
   - Replace older turns with a single `[Conversation summary]` user message
   - Log the token reduction

**Key design decisions:**
- Uses `transformParams` (not `wrapGenerate`) so it works with both `generateText` and `streamText`
- Summarization model is separate from the chat model — always fast/cheap
- Fails gracefully: if summarization errors, returns original params unchanged
- Tool calls in old messages are serialized as `[Called tool: name]` with truncated results

### System Prompt Caching

**File:** `src/app/api/chat/route.ts` (module-level cache)

The system prompt consists of visual instructions + agent instructions + org rules. These are stable across requests for the same org and visual level, so they are cached in-memory.

**How it works:**

1. Load org rules from Supabase
2. Compute cache key: `orgId + MD5(rulesSection + visualLevel)`
3. Check in-memory `Map` for a cached prompt
4. If hit and not expired (5-min TTL): use cached prompt
5. If miss: assemble prompt, store in cache
6. Date/time context is appended after caching (changes every request)

**Cache properties:**
- TTL: 5 minutes
- Eviction: lazy on read + periodic sweep when cache exceeds 100 entries
- Scope: per-process (each serverless instance has its own cache)
- No Redis needed — the cache is a simple optimization for warm instances

### Priority Docs Flow

**File:** `src/lib/ai/priority-docs.ts`

Priority docs and rules flow into the system prompt through two paths:

1. **File-based priority docs:** Loaded from `docs/priority/*.md` on disk, sorted alphabetically, concatenated with section headers. Used for static team-level docs.
2. **Database rules:** Loaded from the `rules` table filtered by `org_id` and `is_active = true`, ordered by `priority`. Formatted as a bulleted list under "User Rules" heading.

The rules section is injected at the end of the system prompt, after agent instructions. The LLM is told these are mandatory ("you MUST follow them").

### Context Window Tracking

**File:** `src/lib/ai/token-counter.ts`

Token estimation uses a character-based heuristic (~4 chars per token). This is intentionally imprecise — it's used for UI display and threshold checks, not billing (which uses provider-reported counts).

**Key functions:**
- `estimateTokens(text)` — core heuristic (text.length / 4)
- `getContextWindow(modelId)` — lookup model's input token limit
- `buildContextBreakdown()` — decompose context usage into system/rules/tools/history segments with utilization percentage
- `estimateMessageTokens(message)` — estimate a single UIMessage including tool call parts

**Context window sizes:** Defined per model in `MODEL_CONTEXT_WINDOWS`. Ranges from 128K (OpenAI) to 2M (Gemini Pro). Default fallback is 128K for unknown models.

The `ContextWindowBar` component (`src/components/chat/context-window-bar.tsx`) uses these estimates to show users a real-time visualization of their context usage in the chat UI.

---

*Context Engineering Architecture v1.1 — Layers / Mirror Factory*
*Updated with runtime context engineering: compaction, caching, priority docs, token tracking*
