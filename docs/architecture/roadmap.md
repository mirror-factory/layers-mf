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

## Known Bugs (Fix Before New Features)

| Bug | Area | Details |
|-----|------|---------|
| Skills slash commands not appearing | Skills/Chat | Newly added skills don't show in slash command menu until page refresh |
| Connectors "Add Integration" button broken | Connectors | Button opens nothing — no modal/page showing available integrations |
| Scheduling not working end-to-end | Scheduling | Cron triggers but doesn't create background chats or send notifications |
| Skill editor not using TipTap | Skills | Editor needs same TipTap editor as chat/documents with save capability |
| MCP server connection not discoverable | Connectors | Users can't find or add MCP servers easily |

---

## What's Not Built (Prioritized)

### P0 — Next Up (Current Sprint)

**1. /overview showcase page**
- Full product overview at `/overview` showing all capabilities
- Live mini-component demos: chat, sandbox, TipTap, interview tool, web search
- Simulated multi-user chat, artifact tabs (code/document/sandbox)
- NeuralDots animation throughout
- Scheduling vision, MCP connectors, sharing, organizations
- Current status + roadmap narrative (positive framing, not "broken" list)
- Story of what the platform is and where it's going

**2. Context library polish**
- Content detail view (full content, metadata, tags, related items on click)
- Inline preview (hover card or side panel)
- Bulk actions (select multiple → tag, move, archive, delete)
- Empty states for collections, tags, search
- Filter persistence (remember last state)
- Visual polish (card sizing, spacing, responsive)
- Consistent content type icons across library, chat, search

**3. Connectors & ingestion overhaul**
- Fix "Add Integration" button — modal showing all available integrations (Nango + MCP)
- Connector status page: sync history, error details, last sync time
- Break monolithic sync route (1,285 lines) into queue-based pipeline
- Semantic chunking (recursive 400-512 tokens, not 12K truncation)
- Incremental sync (delta detection, not full re-sync)
- Webhook listeners (Drive, Slack, Linear push events)
- Retry/dead-letter queue for failed items
- Content deduplication across sources

**4. Sharing for all content types**
- Public share links for artifacts (like conversation shares)
- Public share links for context items/documents
- Share dialog wired up for artifacts + context items (API exists)
- "Shared with me" sidebar section
- Download/export (individual items, bulk ZIP, artifact project ZIP)
- Sharing flow diagrams in docs (between people, between orgs)

**5. Organization management**
- Org dashboard: member count, content stats, usage, costs
- Org-level rules & priorities (like personal rules but for all members)
- Org activity feed: who added what, shared what, who's active
- Org library view (what the org collectively knows)
- "See all shared things" view
- Proper member management polish (role UI, invite flow)

### P1 — Important

**6. Scheduling system (rebuild)**
- Scheduling = start a background chat with a prompt on a cron
- Chat runs autonomously, generates artifacts, stores results
- Notify user via desktop (macOS) + iOS push (Capacitor)
- Notification includes link to chat + any sandbox/artifact created
- Visual flow preview: show the scheduled process as an artifact
- Schedule management page: create, edit, pause, delete, view history
- Example: "Every day 9am: news + weather → sandbox dashboard → notify me"

**7. Notifications & inbox system**
- Desktop notifications (macOS Notification Center)
- iOS push notifications (Capacitor plugin)
- Notification types: scheduled tasks, chat mentions, library changes, sharing, approvals
- Inbox page: unified feed of all notifications
- Notification preferences (which types, which channels)
- Unread badges on sidebar

**8. Skills system polish**
- Fix slash commands not appearing for new skills
- Skill creator modeled after skills.sh
- TipTap editor for skill content (same editor as chat/documents)
- Save/edit capability in skill editor
- Skill templates and marketplace integration

**9. Smart collections & AI features**
- JSONB filter execution engine for smart collections
- UI to create/edit smart collections
- Built-in smart collections (Needs Review, Added This Week, Untagged, Stale)
- Background cron for auto-classification on ingestion
- Staleness scoring (content-type-specific decay)
- Related items precomputation (embedding similarity)

**10. Multi-user collaborative chat**
- Multiple users in one conversation
- @mention users → they get notified and can respond in the chat
- @mention AI → responds when tagged
- "AI watching" toggle → AI monitors and jumps in when relevant
- Real-time presence (who's online, typing indicator)
- Conversation roles (owner, participant, viewer)

### P2 — Future / Platform

**11. Per-resource permissions & approvals**
- View/Comment/Edit/Admin per item
- Permission inheritance (org default → collection → item)
- Approval workflows for document edits, scheduled tasks
- Pending approvals in inbox/notifications
- Hierarchy-based approval routing
- Admin controls (disable public sharing, audit log)

**12. Multi-org support**
- Users join multiple orgs
- Org switcher
- Guest accounts (free, access only shared items)
- Cross-org sharing
- Org-to-org content sharing

**13. API/SDK layer**
- All features accessible via documented API
- API-first architecture (frontend is just one consumer)
- SDK packages (TypeScript, Python) for building on Layers
- API documentation + playground
- Rate limiting, API keys, usage tracking per consumer

**14. Testing suite**
- Comprehensive test coverage: frontend, API, chat routes
- Integration tests with real Supabase
- Browser tests (Playwright/Expect) for critical flows
- Test any new feature/variation automatically
- CI pipeline: typecheck + unit + integration + e2e on every push

**15. Parallel Agents & AI SDK Advanced Features**
- Parallel tool calling (multiple tools in one step, AI SDK v6 native)
- Agent orchestration — spawn sub-agents from the main chat for complex tasks
- Agent handoff — one agent delegates to another with context transfer
- Background agents — long-running agents that work asynchronously and notify on completion
- Agent memory — persistent memory across conversations (vector store + summarization)
- Agent profiles — different system prompts for different task types (research, coding, PM)
- Multi-model routing — use different models for different tools (fast model for search, flagship for code gen)

**16. Image Generation & Media Tools**
- Image generation via AI Gateway (DALL-E, Stable Diffusion, Flux, Recraft)
- Image editing tools (inpaint, outpaint, upscale, background removal)
- Image-to-text (describe images, extract text from screenshots)
- Audio transcription (Whisper via Gateway)
- Text-to-speech (ElevenLabs, OpenAI TTS via Gateway)
- Video generation (when available via Gateway providers)
- Media artifacts — images, audio, video stored alongside code/document artifacts
- Gallery view in artifact panel for image collections

**17. Content Authoring & Publishing**
- In-chat content creation — ask AI to draft docs, then publish directly
- Guided content authoring wizard (step-by-step doc creation with AI assist)
- Publish to multiple destinations from one source:
  - Public shareable link (already built for conversations)
  - Shareable markdown/HTML docs with passcode or token auth
  - Email sharing with token-protected links (Resend/SendGrid)
  - SMS sharing with short links + passcodes (Twilio)
  - Export to PDF, DOCX, or static HTML site
- Sandbox publishing — snapshot a sandbox as a static site, deploy to Vercel
- Content versioning with diff view (track all changes, restore any version)

**18. Cross-Platform Sharing & Connectors**
- Share Layers content TO other platforms:
  - ChatGPT — share as a custom GPT knowledge file or conversation context
  - Claude — share via MCP server (Layers as an MCP provider others connect to)
  - Slack — post artifacts, documents, or chat summaries to channels
  - Notion — sync documents bidirectionally (not just import)
  - Email — send formatted content with token-protected view links
  - Discord — bot that posts updates and allows queries
- Layers as an MCP Server — expose your org's knowledge as an MCP endpoint that other tools can connect to
- Guided connector setup — step-by-step wizard for connecting Layers to ChatGPT, Claude, Cursor, etc.
- Token/passcode sharing — generate time-limited access tokens for specific content without requiring a Layers account
- Guest view portal — lightweight read-only UI for recipients who don't have Layers accounts
- QR code sharing — generate QR codes for sandbox previews and shared documents

**19. Browser Automation (Browserbase)**
- Browserbase integration ($20/mo Developer plan — 100 browser hours)
- `browse_web` tool: navigate, click, type, screenshot, extract
- Live view embedded in artifact panel (iframe with debuggerFullscreenUrl)
- Session per conversation, heartbeat every 5min (10-min CDP timeout)
- Browserbase Contexts for persistent auth (log in once, reuse cookies)
- Model routing: Gemini Flash or Claude Sonnet for browser tasks (Ollama/local won't work)
- Packages: @browserbasehq/sdk + playwright-core (skip Stagehand, ToolLoopAgent handles reasoning)
- Screenshots as base64 JPEG inline in chat messages
- Env: BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID

**20. Advanced features**
- Version diff (side-by-side comparison)
- Artifact search (across all artifacts + versions)
- Sandbox cost tracking UI (live timer, cumulative cost)
- Sandbox console (terminal for dev server logs)
- Content marketplace (publish collections as knowledge packs)
- Voice/live transcription (Gemini Live API)
- Vertical templates (HR, customer support, research)
- Canvas/whiteboard — visual collaboration space with AI assist
- Workflow builder — visual tool for creating multi-step automations

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
