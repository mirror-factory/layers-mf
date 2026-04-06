# Layers Roadmap — What's Built, What's Next

> Single source of truth for implementation status and priorities.
> Last updated: 2026-04-06
> Session count: 4 (Apr 1-6, 2026)
> Total commits: ~130

---

## What's Shipped (Working in Production)

### Chat & AI
- ✅ Agentic chat with ToolLoopAgent (9 models via AI Gateway)
- ✅ Thinking indicator (shows immediately on send)
- ✅ Inline HTML visuals (Chart.js, GSAP, anime.js, etc.)
- ✅ Error handling with smart messages + Retry button
- ✅ Chat persistence (auto-create conversation, await saves)
- ✅ Auto-title generation (Gemini Flash)
- ✅ Slash commands, visual frequency control
- ✅ NeuralDots/NeuralMorph avatar with emotions
- ✅ Context window bar (token counter)
- ✅ sendAutomaticallyWhen for client-side tools (ask_user, artifact_panel)

### Artifacts & Sandboxes
- ✅ write_code, edit_code, run_project, run_code tools
- ✅ create_document, edit_document (TipTap editor)
- ✅ Artifact versioning (create, restore, delete versions)
- ✅ File tree navigation for multi-file projects
- ✅ Per-artifact sandbox management (start/stop/restart)
- ✅ Deterministic sandbox naming (layers-{org}-{artifact})
- ✅ Auto-open artifact panel on tool completion
- ✅ artifact_panel tool (open/close from AI)
- ✅ artifact_get, artifact_delete tools
- ✅ Sandbox health check polling

### Knowledge Library
- ✅ Context items from 8+ sources (Drive, GitHub, Slack, Linear, Notion, Gmail, Granola, uploads)
- ✅ Hybrid search (vector + BM25 with RRF)
- ✅ Collections (folders, 3-level nesting, multi-assign)
- ✅ Tags (user-created, org-scoped, usage count)
- ✅ Pins (user-scoped quick access)
- ✅ Archive (soft delete with restore)
- ✅ Collections sidebar with system sections (All, Pinned, Recent, Archived)
- ✅ Tag chips on items (clickable to filter)
- ✅ File upload (PDF, DOCX, TXT, MD)
- ✅ AI classification endpoint (manual trigger)

### Sharing
- ✅ Conversation sharing (user-to-user within org)
- ✅ Public share links for conversations (/share/[token])
- ✅ Share page works for non-logged-in users (middleware + admin client fix)
- ✅ Read-only share view (no sidebar, no input, no nav)

### Integrations
- ✅ Nango OAuth for 6 services (Drive, GitHub, Slack, Linear, Gmail, Notion)
- ✅ MCP server connections with PKCE OAuth
- ✅ Connector status page
- ✅ ConnectionManager singleton with auto-refresh

### Skills
- ✅ Skill creation (via chat interview or direct API)
- ✅ Skill activation via slash commands
- ✅ .skill/.json file upload
- ✅ Skills marketplace search

### Infrastructure
- ✅ System prompt caching (5-min TTL)
- ✅ Message pruning/compaction middleware
- ✅ Credit system with rate limiting
- ✅ Usage logging (per-request cost tracking)
- ✅ Capacitor iOS app shell

---

## What's Partially Built (API exists, needs UI or testing)

- ⚠️ Context item/artifact sharing (API at /api/sharing, ShareDialog may work but untested)
- ⚠️ Smart collections (DB schema + API accepts smart_filter JSONB, no query engine or UI)
- ⚠️ AI auto-classification (classifyContent() works, no background cron running)
- ⚠️ Priority docs management (API at /api/priority-docs, no UI)
- ⚠️ Bulk operations in library (API at /api/context/bulk, UI partially wired)

---

## What's Not Built (Prioritized)

### P0 — Next Up

**1. Context library polish**
- Content detail view (full content, metadata, tags, related items on click)
- Inline preview (hover card or side panel)
- Bulk actions (select multiple → tag, move, archive, delete)
- Empty states for collections, tags, search
- Filter persistence (remember last state)
- Visual polish (card sizing, spacing, responsive)

**2. Sharing for all content types**
- Public share links for artifacts (like conversation shares)
- Public share links for context items/documents
- Share dialog wired up for artifacts + context items (API exists)
- "Shared with me" sidebar section
- Download/export (individual items, bulk ZIP, artifact project ZIP)

**3. Ingestion pipeline refactor**
- Break monolithic sync route (1,285 lines) into queue-based pipeline
- Semantic chunking (recursive 400-512 tokens, not 12K truncation)
- Incremental sync (delta detection, not full re-sync)
- Webhook listeners (Drive, Slack, Linear push events)
- Retry/dead-letter queue for failed items
- Content deduplication across sources

### P1 — Important

**4. Smart collections**
- JSONB filter execution engine
- UI to create/edit smart collections
- Built-in smart collections (Needs Review, Added This Week, Untagged, Stale)

**5. AI auto-classification pipeline**
- Background cron job on ingestion
- Auto-tag, auto-categorize every new item
- Staleness scoring (content-type-specific decay)
- Related items precomputation (embedding similarity)

**6. Multi-user collaborative chat**
- Multiple users in one conversation
- @mention users (notify + include in context)
- Real-time presence (who's online, typing indicator)
- AI responds when @mentioned or addressed

### P2 — Future

**7. Per-resource permissions**
- View/Comment/Edit/Admin per item
- Permission inheritance (org default → collection → item)
- Admin controls (disable public sharing, audit log)

**8. Multi-org support**
- Users join multiple orgs
- Org switcher
- Guest accounts (free, access only shared items)
- Cross-org sharing

**9. Advanced features**
- Version diff (side-by-side comparison)
- Artifact search (across all artifacts + versions)
- Sandbox cost tracking UI (live timer, cumulative cost)
- Sandbox console (terminal for dev server logs)
- Content marketplace (publish collections as knowledge packs)

---

## Architecture Docs Index

| Doc | Status | What It Covers |
|-----|--------|---------------|
| **roadmap.md** (this doc) | Active | Master status + priorities |
| **library-hub-and-sharing.md** | Active | Product vision — library as central hub |
| **content-organization.md** | Active | Collections, tags, smart filters, AI classification (technical) |
| **ingestion-pipeline.md** | RFC | Queue-based ingestion redesign |
| **sharing-permissions.md** | RFC | Per-resource permissions model |
| **org-permissions-system.md** | Proposal | Multi-org, roles, guests |
| **universal-artifact-system.md** | Active | Artifact storage, versioning, sandbox management |
| **artifact-system-v2.md** | Active | Artifact types, tool registry, missing tools |
| **context-engineering.md** | Active | System prompt caching, compaction, priority docs |
| **brand-guide.md** | Active | Colors, fonts, animation, component patterns |
| **tool-result-cards.md** | Active | Tool output card component |
| **connector-persistence.md** | Active | MCP connection management |
| **mobile-app.md** | Active | Capacitor iOS/Android setup |
| **execution-plan.md** | Historical | Sessions 1-2 epic tracking (complete) |

**Archived:** knowledge-library-system.md, knowledge-library-system-v2.md, accounts-orgs-sharing.md, sharing-system.md, diagrams.md
