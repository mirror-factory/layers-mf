> **⚠️ ARCHIVED** — This document is outdated. See [content-organization.md](../content-organization.md) and [library-hub-and-sharing.md](../library-hub-and-sharing.md) for current information.
> Moved to archive on 2026-04-06.

---

# Knowledge Library & Context Engineering — Complete Requirements

> Status: Research & Planning
> Owner: Mirror Factory (Alfonso, Kyle, Bobby)
> Last updated: 2026-04-02
> Priority: CRITICAL — Core product infrastructure

---

## Every Single Point From Alfonso

### A. Library & Content Viewer

1. **Proper extensive filtering system**
   - Filter by type (document, code, file, meeting, issue, message, image, CSV)
   - Filter by tags (user-added + AI-generated)
   - Filter by categories (AI-generated)
   - Filter by source (Google Drive, GitHub, Slack, Linear, Granola, upload, AI-generated)
   - Filter by date range
   - Filter by status (ready, processing, archived)
   - Filter by who created it
   - Filter by who shared it
   - Multiple filters combinable

2. **Tagging system**
   - AI auto-tags every item on ingestion
   - Users can add/remove tags manually
   - Tags are searchable
   - Tag suggestions based on content
   - Tag management page (rename, merge, delete tags)

3. **Mac-like column/Finder view**
   - Left column: sources/root folders
   - Middle column: subfolders/categories
   - Right column: files/items
   - Click to navigate deeper
   - Breadcrumb trail at top
   - Similar to Google Drive's folder navigation

4. **Hierarchies and folder structures**
   - User-created folders
   - Auto-generated folders from sources (Drive syncs folder structure)
   - Drag and drop to organize
   - Nested folders
   - Move items between folders

5. **Viewer — open different file types from library**
   - Documents → TipTap rich text editor (FIRST priority)
   - Code → code viewer with syntax highlighting + editing
   - Sandbox projects → code editor + live preview
   - Images → image viewer
   - CSV → table viewer
   - Meetings → transcript viewer with speaker labels
   - Issues → issue card viewer
   - Messages → message thread viewer
   - PDFs → PDF viewer

6. **Open in chat**
   - Any item can be opened/referenced in a chat conversation
   - Click "Open in Chat" → starts new conversation with item as context
   - Or drag item into existing chat as reference
   - AI can search and reference library items during conversation

7. **Right-click context menu on any file**
   - Share with specific people
   - Make public (within org)
   - Edit metadata (title, description, tags)
   - Move to folder
   - Download
   - Delete
   - View version history
   - Copy link
   - Open in Chat
   - Open in Editor/Viewer

### B. AI Classification & Registry

8. **Every item that enters the system gets AI-processed**
   - EVERY item — no exceptions (uploads, syncs, AI-generated, imports)
   - Processing happens in background
   - User notified when complete

9. **Registry data per item**
   - Name/title (auto-generated if missing)
   - Short description (~50 words, auto-generated)
   - Long description (~200 words, auto-generated)
   - Tags (auto-generated + user-editable)
   - Categories (auto-generated)
   - One-liner description (~10 words, for search results)
   - Content type detection
   - Language detection (for code)
   - Framework detection (for code)
   - Entity extraction (people, topics, decisions, action items, dates, projects)
   - Sentiment/tone (for messages, emails)
   - Key quotes/highlights
   - Related items (based on embedding similarity)

10. **Embeddings**
    - Generated for every item on ingestion
    - Used for vector search (semantic similarity)
    - Research needed: Gemini 2026 embeddings vs OpenAI
    - Research needed: cost comparison
    - Research needed: quality comparison
    - Research needed: dimension size impact on Supabase pgvector

### C. Embeddings Research (DETAILED)

11. **OpenAI embeddings**
    - Current industry standard
    - text-embedding-3-small: 1536 dims, $0.02/1M tokens
    - text-embedding-3-large: 3072 dims, $0.13/1M tokens
    - Mature, well-documented

12. **Gemini embeddings (2026 — newer)**
    - text-embedding-005: 768 dims, FREE tier
    - gemini-embedding-exp: 3072 dims, experimental
    - Reportedly cheaper AND better quality
    - Need to research: how does this work with Supabase?
    - Need to research: any compatibility issues?
    - Need to research: is the quality actually better?
    - Need to research: what's the max input length?
    - Need to research: task-type parameter (RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY)

13. **Impact on Supabase pgvector**
    - Does changing embedding model require re-embedding everything?
    - Does dimension size affect query speed significantly?
    - Is 768 dims (Gemini) vs 1536 (OpenAI) a meaningful difference?
    - Cost of pgvector at scale (storage, compute)
    - HNSW vs IVFFlat indexing — which should we use?

### D. Search System (DETAILED)

14. **How search currently works**
    - `search_context_items` RPC: hybrid vector + BM25
    - Vector search: cosine similarity on embedding column
    - BM25: full-text search on search_tsv column
    - Reciprocal Rank Fusion (RRF) combines rankings
    - Trust weight multiplied by priority_weight
    - Returns confidence score/percentage

15. **Questions about current search**
    - Is it doing multiple searches? YES — vector + BM25 + RRF
    - Is it searching file names? YES — via BM25 on search_tsv
    - Is the confidence percentage accurate? It's RRF score, not true probability
    - Is there cost per search? Minimal — Supabase compute only
    - How fast is it? ~20-60ms for current scale

16. **Search improvements needed**
    - Faceted search (filter by type/source while searching)
    - Search within specific folders
    - Search with date range
    - "More like this" — find similar items
    - Recent searches history
    - Search suggestions/autocomplete

### E. Data Sources & Connectors

17. **Google Drive selective import**
    - File picker: browse Drive, select specific files or folders
    - Import in background (don't block UI)
    - Progress indicator: "3 of 12 files processed"
    - Notification when complete: "Import done — 12 files ready"
    - Sync folder structure from Drive
    - Incremental sync: only new/changed files

18. **All data sources to support**
    - Google Drive (files, docs, sheets)
    - GitHub (repos, files, PRs, issues, discussions)
    - Slack (messages, channels, threads)
    - Linear (issues, projects, cycles)
    - Granola (meetings, transcripts)
    - Notion (pages, databases)
    - Gmail (emails, threads, attachments)
    - File uploads (PDF, DOCX, TXT, MD, CSV, images)
    - URL/web page imports
    - API webhooks (incoming data)

19. **Connectors page — consolidated MCP + API**
    - Single page for ALL connections (not split between MCP and integrations)
    - Question: Do we even need APIs if MCPs support everything?
    - Answer: Keep both — not all services have MCPs yet
    - MCPs for services that support them (Granola, GitHub, Linear, Slack)
    - Nango API for services without MCP
    - Modern, polished UI matching the chat design we built
    - Use dot animations and sleek/modern look
    - Connection status indicators (connected, disconnected, error)
    - Auto-reconnection on token expiry (FIX THE DISCONNECTION BUG)

20. **Connector permissions**
    - Read vs Write toggles per connector
    - Read AND Write option
    - Per-user permission overrides (admin can restrict a member to read-only)

21. **Connector sharing**
    - Share connector access with other team members
    - So they have access to the connected account's data
    - Shared connectors appear in their library
    - Shared connector data is searchable in their vector DB

22. **Persistent connections**
    - Connections should NOT go away on server restart
    - OAuth tokens should auto-refresh
    - Connection state stored in DB, not just memory
    - Reconnection logic on startup

### F. Context Engineering

23. **Compaction**
    - Already built: auto-summarizes at 80% context threshold
    - Full history stays in Supabase
    - User can go back and branch from any point
    - Need to verify it works reliably

24. **Context caching**
    - Vercel AI SDK supports caching repeated context
    - Priority docs and system prompt are the same every call
    - Caching these saves tokens (and money)
    - Research: how does Vercel AI SDK caching work?

25. **Context authoring**
    - Priority documents (already built)
    - Rules (already built)
    - System prompt preview (already built)
    - Need: ability to attach specific items to a conversation as context

26. **Long-term context engineering**
    - Research: best practices for long-term data classification
    - Research: long-term data storage strategies
    - Research: context window management at scale
    - Research: how to keep conversations going indefinitely
    - Multi-query expansion (already built)
    - Selective context loading based on query relevance

### G. Sharing & Collaboration

27. **File sharing within org**
    - Right-click → Share with specific people
    - Make public within org
    - Share across teams
    - Shared files appear in recipient's library
    - Shared files searchable in recipient's vector DB
    - Both search AND browsable

28. **Permission levels**
    - Viewer: read, search, reference in chat
    - Editor: all viewer + edit, add tags, modify
    - Owner: all editor + share, delete, transfer
    - Inheritable: folder permissions cascade to contents

29. **Cross-team sharing model**
    - Like Google Drive sharing
    - "Shared with me" section in library
    - Shared items maintain their own version history
    - Changes sync (if editor+ permission)
    - Can revoke access

### H. UI/UX Requirements

30. **Library page must be polished**
    - Match the quality of the chat UI we built
    - Use NeuralDots/animations where appropriate
    - Modern, sleek, dark theme
    - Responsive for different screen sizes

31. **Connectors page must be polished**
    - Modern card design for each connector
    - Status indicators with animations
    - Clean toggle switches for permissions
    - Search for available connectors

### I. MCP/API Specific Issues

32. **Why do connections keep dropping?**
    - OAuth tokens expire (typically 1 hour)
    - Nango doesn't always proactively refresh
    - Server restart clears in-memory connection state
    - Need: automatic token refresh middleware
    - Need: connection state persisted to DB
    - Need: reconnection on startup

33. **MCP vs API decision framework**
    - MCP when available: standardized, real-time, dynamic tools
    - API (Nango) when no MCP: universal, reliable refresh
    - Some services: both (e.g., GitHub has MCP AND API)
    - Let user choose which to use per service
    - Consolidated UI regardless of underlying connection type

---

## Architecture Docs Index

| Document | Location | Status |
|----------|----------|--------|
| Universal Artifact System | `docs/architecture/universal-artifact-system.md` | Phases 1-5 complete |
| Accounts, Orgs & Sharing | `docs/architecture/accounts-orgs-sharing.md` | Complete |
| Brand Guide | `docs/architecture/brand-guide.md` | Complete |
| Tool Result Cards | `docs/architecture/tool-result-cards.md` | Planning |
| Knowledge Library (this) | `docs/architecture/knowledge-library-system-v2.md` | Research & Planning |

---

### J. Artifact Lookup & Auto-Open (CRITICAL FIX)

34. **Artifacts must be in vector search**
    - When artifacts are created, they ARE saved to context_items (we do this already)
    - But: the search results don't indicate "this is an artifact — click to open in viewer"
    - Need: search results that are artifacts should have an "Open in Viewer" action
    - Need: different UI treatment for artifact results vs regular context items

35. **AI should auto-open artifacts in the viewer**
    - When AI calls `artifact_get`, the tool output should include artifact data
    - The ToolCallCard should detect artifact data and auto-open the artifact panel
    - User sees the document/code/sandbox in the right panel immediately
    - No need to click — it just opens

36. **artifact_get should return openable data**
    - Current: returns content as text to the AI
    - Needed: returns a structured object that the client renders as an openable artifact card
    - The card should be clickable → opens artifact panel
    - OR: auto-opens on completion (like how sandbox artifacts auto-open)

37. **search_context should flag artifacts**
    - When search results include items with source_id starting with "artifact-"
    - Those results should render differently: artifact card with "Open" button
    - Clicking "Open" loads the artifact into the panel
    - AI can also say "I found this artifact" and the user can click to open it

38. **Unified viewer for all content types**
    - Documents → TipTap editor in artifact panel
    - Code → syntax highlighted editor in artifact panel
    - Sandbox → file tree + code + live preview in artifact panel
    - Meeting transcripts → formatted viewer
    - Everything opens in the same panel system
    - The panel already exists — we just need to route more content types to it

---

## Implementation Priority Order

1. **Fix connector persistence** (connections dropping) — highest pain point
2. **Embeddings upgrade** (Gemini) — cheaper, sets foundation
3. **AI classification pipeline** — auto-tag/describe everything
4. **Library UI overhaul** — Finder-style view with filters
5. **Connectors page consolidation** — MCP + API in one place
6. **Google Drive selective import** — file picker + background processing
7. **Sharing system** — per-file permissions
8. **Context caching** — Vercel AI SDK feature
9. **Viewer system** — open docs/code/sandbox from library
10. **Search improvements** — faceted search, suggestions
