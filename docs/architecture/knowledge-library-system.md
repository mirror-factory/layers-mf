# Knowledge Library & Context Engineering — Architecture Document

> Status: Research & Planning
> Owner: Mirror Factory (Alfonso, Kyle, Bobby)
> Last updated: 2026-04-02
> Priority: HIGH — This is the core of the product

---

## 1. Requirements (From Alfonso)

### 1.1 Library & Viewer
- [ ] Proper filtering system: by type, tags, categories, source, date
- [ ] Mac-like column/folder view (similar to Finder or Google Drive)
- [ ] Hierarchies and folder structures
- [ ] Open documents in chat (TipTap editor)
- [ ] Open code in viewer/editor
- [ ] Sandbox code execution from library
- [ ] Right-click context menu: share, make public, edit, delete
- [ ] Ability to open items in chat to reference them

### 1.2 AI Classification & Registry
Every item that enters the system gets processed by AI:
- [ ] Short description (auto-generated)
- [ ] Long description (auto-generated)
- [ ] Tags (auto-generated + user-editable)
- [ ] Categories (auto-generated)
- [ ] Name/title (auto-generated or from source)
- [ ] Embeddings (for vector search)
- [ ] Entity extraction (people, topics, decisions, action items)
- [ ] Content type detection
- [ ] Language detection (for code)
- [ ] Framework detection (for code)

### 1.3 Data Sources & Connectors
- [ ] Google Drive: select one or many files, import in background, notify when done
- [ ] GitHub: repos, files, PRs, issues
- [ ] Slack: messages, channels
- [ ] Linear: issues, projects
- [ ] Granola: meetings, transcripts
- [ ] Notion: pages, databases
- [ ] Gmail: emails, threads
- [ ] File uploads: PDF, DOCX, TXT, MD, CSV
- [ ] URL scraping: import web pages
- [ ] Connectors page: consolidated MCP + API connections
- [ ] Persistent connections (don't disconnect)
- [ ] Shareable access across team members
- [ ] Read vs Write permissions per connector

### 1.4 Search & Context
- [ ] Hybrid search: vector embeddings + BM25 text search
- [ ] Research: Gemini 2026 embeddings vs OpenAI embeddings
- [ ] Research: cost comparison
- [ ] Research: Supabase pgvector performance
- [ ] Confidence scores on search results
- [ ] Context compaction for long conversations
- [ ] Context caching (Vercel AI SDK)
- [ ] Context authoring (Priority docs + rules)

### 1.5 Sharing & Collaboration
- [ ] Share files with specific team members
- [ ] Make files public within org
- [ ] Share across teams (like Google Drive sharing)
- [ ] Shared files appear in recipient's library
- [ ] Shared files searchable in recipient's vector DB
- [ ] Read-only vs read-write sharing
- [ ] Role-based access (owner, editor, viewer)

### 1.6 Connectors Page
- [ ] Consolidated view for MCP + API connections
- [ ] Modern, polished UI (matching chat design)
- [ ] Connection status indicators
- [ ] Read/Write permission toggles
- [ ] Share connector access with team
- [ ] Search for available connectors
- [ ] Auto-reconnection on token expiry

---

## 2. Research: Embeddings

### 2.1 Current State
- Using Supabase pgvector with `embedding` column on `context_items`
- Embeddings generated during ingestion pipeline
- Search uses `search_context_items` RPC: hybrid vector + BM25
- Also has `search_context_items_text` RPC: text-only fallback

### 2.2 OpenAI Embeddings
| Model | Dimensions | Price (per 1M tokens) | Quality |
|-------|-----------|----------------------|---------|
| text-embedding-3-small | 1536 | $0.02 | Good |
| text-embedding-3-large | 3072 | $0.13 | Better |
| text-embedding-ada-002 | 1536 | $0.10 | Legacy |

### 2.3 Google Gemini Embeddings (2026)
| Model | Dimensions | Price (per 1M tokens) | Quality |
|-------|-----------|----------------------|---------|
| text-embedding-005 | 768 | $0.00 (free tier) | Good |
| gemini-embedding-exp | 3072 | $0.00 (experimental) | Excellent |

**Key advantages of Gemini embeddings:**
- Free tier available (text-embedding-005)
- Experimental model with 3072 dimensions matching OpenAI large
- Works through Vercel AI Gateway (same infrastructure)
- Task-type parameter: RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY, etc.

### 2.4 Recommendation
**Use Gemini text-embedding-005 for cost efficiency**, upgrade to gemini-embedding-exp when it's stable. Reasons:
- Free/very cheap vs $0.02-$0.13 per 1M tokens for OpenAI
- Quality is competitive for retrieval tasks
- Goes through our existing AI Gateway
- 768 dimensions is sufficient for most use cases (smaller = faster pgvector queries)

### 2.5 Impact on Supabase
- pgvector supports any dimension count
- Smaller dimensions (768 vs 1536) = faster queries, less storage
- No schema change needed — just update the embedding generation function
- Re-embed existing content if switching models

---

## 3. Research: Supabase pgvector Performance

### 3.1 How Our Search Works Now
The `search_context_items` RPC does:
1. **Vector search**: cosine similarity on `embedding` column using pgvector
2. **BM25 text search**: full-text search on `search_tsv` column
3. **Reciprocal Rank Fusion (RRF)**: combines both rankings
4. **Trust weight**: multiplied by `priority_weight` column
5. Returns: id, title, source_type, content_type, rrf_score, trust_weight, days_ago

### 3.2 Performance
- pgvector with IVFFlat index: ~50ms for 10K items
- pgvector with HNSW index: ~10ms for 10K items (recommended)
- BM25 via tsvector: ~5ms
- Combined: ~20-60ms total
- Cost: minimal — Supabase charges for storage + compute, not per-query

### 3.3 Scaling Considerations
- Under 100K items: pgvector on Supabase is fine
- 100K-1M items: consider HNSW index, partitioning
- 1M+ items: consider dedicated vector DB (Pinecone, Weaviate)
- For Granger's current scale (hundreds to low thousands of items): Supabase is excellent

---

## 4. Research: Context Engineering (Vercel AI SDK)

### 4.1 What We Already Have
- **Compaction middleware** (`src/lib/ai/compaction-middleware.ts`): auto-summarizes old messages with Haiku at 80% context threshold
- **Priority documents**: prepended to system prompt
- **Rules**: injected as user rules section
- **Token counter**: estimates context window usage
- **Context window bar**: visualizes usage in chat UI
- **pruneMessages**: removes old tool calls and reasoning

### 4.2 What We Should Add
- **Context caching**: Vercel AI SDK supports caching repeated context (priority docs, system prompt) — saves tokens on repeated calls
- **Sliding window with summaries**: keep last N messages verbatim, summarize older ones
- **Selective context loading**: only load relevant priority docs based on query
- **Context budget allocation**: reserve X% for system, Y% for history, Z% for tools
- **Multi-query expansion**: expand search queries for better recall (already implemented)

### 4.3 Compaction Flow (Already Built)
```
Message count exceeds threshold
  → Summarize old messages (keep last 4 verbatim)
  → Replace older messages with summary
  → Continue conversation with compressed history
  → Full history still in Supabase (can branch from any point)
```

---

## 5. Research: MCPs vs APIs

### 5.1 MCP (Model Context Protocol)
**Pros:**
- Standardized tool interface
- OAuth/PKCE authentication built in
- Dynamic tool discovery
- Real-time connection
- Growing ecosystem

**Cons:**
- Not all services have MCP servers yet
- Connection stability issues (token expiry → disconnects)
- Requires running server/proxy

### 5.2 Traditional APIs (via Nango)
**Pros:**
- Universal — any service with an API
- OAuth handled by Nango
- Reliable token refresh
- No server to maintain

**Cons:**
- Each integration is custom code
- No standardized tool interface
- More maintenance

### 5.3 Recommendation
**Keep both.** Use MCP when available (Granola, GitHub, Linear, Slack), fall back to Nango API integrations for services without MCP. Consolidate the UI into a single "Connectors" page.

### 5.4 Why Connections Drop
The MCP disconnection issue is likely:
1. **OAuth token expiry**: tokens expire after 1 hour, refresh isn't automatic
2. **Server restart**: dev server restart clears in-memory MCP connections
3. **Nango token refresh lag**: Nango may not proactively refresh tokens

**Fix needed:** Add automatic token refresh + reconnection logic in MCP client.

---

## 6. Library UI Design

### 6.1 Column/Finder View
```
┌──────────────┬──────────────┬────────────────────────┐
│ Sources      │ Folders      │ Files                  │
│              │              │                        │
│ All          │ Projects/    │ [icon] dashboard.tsx   │
│ Google Drive │ Meetings/    │ [icon] api-spec.md     │
│ GitHub       │ Documents/   │ [icon] Q2 OKRs.docx   │
│ Slack        │ Code/        │ [icon] meeting-notes   │
│ Linear       │ Imports/     │                        │
│ Granola      │              │                        │
│ Uploads      │              │                        │
│ AI Generated │              │                        │
├──────────────┴──────────────┴────────────────────────┤
│ Search: [________________________]  Filter: [v]      │
│ Tags: [react] [meeting] [q2]  Type: [All v]         │
└──────────────────────────────────────────────────────┘
```

### 6.2 File Actions (Right-Click Menu)
- Open in Chat
- Open in Editor (docs) / Viewer (code) / Sandbox (projects)
- Share with...
- Make Public
- Add Tags
- Move to Folder
- Download
- Delete
- View Version History
- Copy Link

### 6.3 File Detail Panel
- Title, description, type badge
- Tags (editable)
- Source info (where it came from)
- Version history
- Sharing status
- Embedding status
- Last accessed
- Size / token count

---

## 7. Ingestion Pipeline

### 7.1 Flow for New Content
```
Source (Drive/GitHub/Upload/etc.)
  ↓
1. Fetch content (via Nango/MCP/direct)
  ↓
2. Extract text (PDF parsing, HTML stripping, etc.)
  ↓
3. AI Classification (Flash Lite):
   - Generate title (if missing)
   - Generate short description
   - Generate long description
   - Extract tags
   - Detect categories
   - Extract entities (people, topics, decisions)
   - Detect language/framework
  ↓
4. Generate embeddings (Gemini text-embedding-005)
  ↓
5. Store in context_items + artifacts table
  ↓
6. Index for search (tsvector + pgvector)
  ↓
7. Notify user: "Import complete — 12 files processed"
```

### 7.2 Background Processing
- Use Supabase Edge Functions or Vercel Cron for async processing
- Queue system: items enter as "processing", move to "ready"
- Progress tracking: "3 of 12 files processed"
- Error handling: retry failed items, report permanent failures

---

## 8. Sharing Model

### 8.1 Permission Levels
| Level | Can do |
|-------|--------|
| **Viewer** | Read content, search, reference in chat |
| **Editor** | All viewer + edit content, add tags |
| **Owner** | All editor + share, delete, transfer |

### 8.2 Sharing Mechanics
- Share button on any item → opens share dialog
- Select team members or "Anyone in org"
- Set permission level
- Shared items appear in recipient's library under "Shared with me"
- Shared items are searchable in recipient's vector search
- Changes sync in real-time

### 8.3 Database (New Tables Needed)
```sql
content_shares (
  id, content_id, content_type, -- 'context_item' or 'artifact'
  shared_by, shared_with, -- user IDs
  permission, -- 'viewer', 'editor', 'owner'
  created_at
)
```

---

## 9. Implementation Phases

### Phase 1: Embeddings Upgrade
- Switch to Gemini text-embedding-005
- Re-embed existing content
- Verify search quality

### Phase 2: AI Classification Pipeline
- Auto-classify on ingest
- Generate descriptions, tags, categories
- Entity extraction
- Background processing with notifications

### Phase 3: Library UI Overhaul
- Column/Finder view
- Filtering (type, tags, source, date)
- Search within library
- File detail panel
- Right-click context menu

### Phase 4: Connectors Page
- Consolidated MCP + API view
- Modern UI matching chat design
- Read/Write permission toggles
- Auto-reconnection logic
- Share connector access

### Phase 5: Sharing System
- Share dialog
- Permission levels
- "Shared with me" section
- Cross-team vector search

### Phase 6: Google Drive Selective Import
- File picker (select files/folders)
- Background import with progress
- Notification on completion

---

## 10. Open Questions

1. **Embedding model migration**: Do we re-embed everything at once or gradually?
2. **Folder structure**: Auto-generated from sources or user-created?
3. **Versioning in library**: Does every edit create a version (like artifacts)?
4. **Storage limits**: Per-org limits on total content?
5. **Real-time sync**: Should shared content sync edits in real-time?
6. **Offline access**: Cache content locally for offline chat?
7. **Content deduplication**: How to handle the same file imported from multiple sources?
