# Layers Roadmap — What's Built, What's Next

> Single source of truth for implementation status and priorities.
> Last updated: 2026-04-07
> Session count: 5 (Apr 1-7, 2026)
> Total commits: ~150
> Version: 0.6.0

---

## What's Shipped (Working in Production)

### Chat & AI
- ✅ Agentic chat with ToolLoopAgent (9 models via AI Gateway)
- ✅ Thinking indicator (shows immediately on send)
- ✅ Inline HTML visuals (Chart.js, GSAP, anime.js, etc.)
- ✅ Error handling with smart messages + Retry button
- ✅ Chat persistence (auto-create conversation, await saves)
- ✅ Auto-title generation (Gemini Flash, in stream onFinish)
- ✅ Slash commands, visual frequency control
- ✅ NeuralMorph avatar with orbit formation (white user, green AI)
- ✅ Context window bar (token counter, cost breakdown, cache stats)
- ✅ sendAutomaticallyWhen for client-side tools (ask_user, artifact_panel)
- ✅ Model selection persists to localStorage
- ✅ Chat auto-focus on mount and conversation switch
- ✅ Per-message cost tracking with TTFB, tokens, cache hit rate
- ✅ Prompt caching via AI Gateway (90% savings Anthropic/Google)
- ✅ Share panel (inline in header actions dropdown)

### Mini-Chats (Focused AI Assistants)
- ✅ MCP Assistant on /connectors — search, connect, disconnect MCP servers
- ✅ Schedule Assistant on /schedules — create, edit, delete scheduled tasks
- 🔨 Skills Assistant on /skills — create skills, search marketplace (building)
- All use Gemini Flash, focused system prompts, maxSteps: 5

### MCP Integration (v0.6.0 — All Integrations Are MCP)
- ✅ 5 MCP chat tools: search_mcp_servers, connect_mcp_server, disconnect_mcp_server, list_mcp_servers
- ✅ 3 registry sources: official MCP registry, Smithery (6K+ servers), curated list
- ✅ Inline OAuth card — PKCE flow directly from chat (no redirect to connectors page)
- ✅ Inline API key card — paste token in chat, connects immediately
- ✅ OAuth fallback — when discovery fails, offers "connect without auth" or "enter API key"
- ✅ OAuth callback returns to /chat (not /connectors)
- ✅ MCP ConnectionManager with 10-min cache, auto token refresh
- ✅ Per-server error logging in chat route, error_message surfaced in UI
- ✅ Disconnect (deactivate, can reconnect) vs Remove (permanent delete)
- ✅ Nango fully removed — 67 files, 12,800 lines deleted

### Artifacts & Sandboxes
- ✅ write_code, edit_code, run_project, run_code tools
- ✅ create_document, edit_document (TipTap editor)
- ✅ Artifact versioning (create, restore, delete versions)
- ✅ File tree navigation for multi-file projects
- ✅ Per-artifact sandbox management (start/stop/restart)
- ✅ Deterministic sandbox naming (layers-{org}-{artifact})
- ✅ Auto-open artifact panel on tool completion
- ✅ artifact_panel tool (open/close from AI)

### Knowledge Library
- ✅ Context items from uploads + MCP tool results
- ✅ Hybrid search (vector + BM25 with RRF)
- ✅ Collections (folders, 3-level nesting, multi-assign)
- ✅ Tags, Pins, Archive
- ✅ File upload (PDF, DOCX, TXT, MD, images)

### Notifications
- ✅ Consolidated /notifications page (same data as bell dropdown)
- ✅ Desktop browser notifications (batched, deduped)
- ✅ Schedule notifications: started + complete dual notifications
- ✅ Email notifications via Resend (notifications@mirrorfactory.ai)
- ✅ 7-day notification window, clear-old endpoint
- ✅ iOS push notification pipeline (needs APNs credentials)

### Sharing
- ✅ Conversation sharing (user-to-user within org)
- ✅ Public share links for conversations (/share/[token])
- ✅ Share page works for non-logged-in users

### Scheduling
- ✅ Schedule creation with cron expressions + timezone
- ✅ Background chat execution with notifications
- ✅ Schedule management (create, edit, pause, delete, history)
- ⚠️ Vercel Hobby limits cron to daily — need Pro for per-minute

### Skills
- ✅ Skill creation (via chat interview or direct API)
- ✅ Skill activation via slash commands
- ✅ Skills marketplace search
- ✅ .skill/.json file upload

### Infrastructure
- ✅ All 49 tests passing
- ✅ Deployed to Vercel production
- ✅ Capacitor iOS app shell with safe areas (contentInset: never)
- ✅ Credit system with rate limiting
- ✅ System prompt caching (5-min TTL)

### UI/UX (v0.6.0)
- ✅ Sidebar: 5 main items + collapsible More, no jitter on load
- ✅ NeuralMorph orbit logo in sidebar
- ✅ Single header bar with actions dropdown
- ✅ Glass effect prompt bar with gradient fade
- ✅ Single send/stop toggle button
- ✅ Image attachments right-aligned for user messages

---

## Known Issues (Fix Before New Features)

| Issue | Area | Details |
|-------|------|---------|
| MCP tools not loading in chat | MCP/Chat | OAuth token refresh may fail for some servers; connection errors swallowed |
| Canva MCP connected but tools may not load | MCP | Needs verification — may be protocol version or timeout |
| iOS safe areas untested on device | Mobile | contentInset: never set, needs Xcode build + device test |
| APNs credentials not configured | Push | Pipeline built, needs .p8 key from Apple Developer |
| Vercel cron limited to daily on Hobby | Scheduling | Execute-schedules runs once/day at 6am; need Pro or external cron |
| Skills slash commands delayed | Skills | New skills don't appear in menu until page refresh |

---

## Current Phase — What's Being Built Now

### 1. Mini-Chats on Every Page (In Progress)
- ✅ Connectors page — MCP Assistant
- ✅ Scheduling page — Schedule Assistant
- 🔨 Skills page — Skills Assistant
- Each has its own API route, focused tools, Gemini Flash, maxSteps: 5

### 2. Tool Chaining & Reliability
- Ensure AI calls all required tools in multi-step workflows
- Example: "Search knowledge base → email summary via Resend MCP"
- maxSteps controls how many tool calls the AI can chain
- System prompt instructs AI to complete full workflows, not partial

### 3. MCP Connection Verification
- Test end-to-end: connect Granola/Canva from chat → verify tools load
- Verify tool discovery + execution in main chat
- Fix any remaining OAuth token refresh issues

---

## What's Next (Prioritized)

### P0 — Immediate (This Week)

**1. Verify & Polish MCP Tool Loading**
- Test Granola + Canva tools load and work in main chat
- Test connect → use → disconnect cycle end-to-end
- Fix any protocol version or timeout issues
- Add MCP tool count to chat header or status bar

**2. iOS Build & Test**
- Build in Xcode with contentInset: never
- Test safe areas on physical device
- Configure APNs credentials (.p8 key)
- Test push notifications end-to-end

**3. Vercel Pro or External Cron**
- Upgrade to Pro for per-minute schedule execution, OR
- Set up cron-job.org to ping /api/cron/execute-schedules every minute

**4. Context Library Polish**
- Content detail view (full content on click)
- Inline preview (hover card or side panel)
- Bulk actions (select multiple → tag, move, archive)
- Empty states, filter persistence

### P1 — Important (Next 2 Weeks)

**5. Ingestion Pipeline Refactor**
- Break monolithic sync into queue-based pipeline
- Semantic chunking (400-512 tokens, not 12K truncation)
- Incremental sync (delta detection)
- MCP-based ingestion (servers push data via tools)

**6. Skills System Polish**
- Skills as artifacts (TipTap editor, versioning, subfolders)
- Fix slash commands appearing immediately for new skills
- Skill templates from marketplace

**7. Sharing for All Content Types**
- Public share links for artifacts and context items
- "Shared with me" section
- Download/export (individual, bulk ZIP)

**8. Organization Management**
- Org dashboard with member count, content stats, usage
- Org-level rules and priorities
- Activity feed

### P2 — Platform Features (Next Month)

**9. Browser Automation (Browserbase)**
- $20/mo Developer plan — 100 browser hours
- browse_web tool: navigate, click, screenshot, extract
- Live view in artifact panel (iframe)
- Session per conversation, heartbeat every 5min
- Model routing: Gemini Flash for browser tasks

**10. Multi-User Collaborative Chat**
- Multiple users in one conversation
- @mention users and AI
- Real-time presence and typing indicators

**11. Parallel Agents & Advanced AI**
- Parallel tool calling (AI SDK v6 native)
- Agent orchestration — spawn sub-agents
- Multi-model routing (fast for search, flagship for code gen)
- Agent memory across conversations

**12. Image Generation & Media**
- Image generation via AI Gateway (DALL-E, Flux, Recraft)
- Audio transcription (Whisper)
- Text-to-speech
- Media artifacts

**13. Content Authoring & Publishing**
- Draft → publish workflow
- Export to PDF, DOCX, static HTML
- Sandbox publishing to Vercel
- Email sharing with Resend

### P3 — Future Vision

**14. Testing Suite**
- Playwright/Expect for critical flows
- Promptfoo for AI quality testing
- CI pipeline: typecheck + unit + integration + e2e

**15. API/SDK Layer**
- Public API with documentation
- TypeScript/Python SDKs
- Rate limiting, API keys per consumer

**16. Layers as MCP Server**
- Expose org knowledge as an MCP endpoint
- Other AI tools (Claude Desktop, Cursor) connect to Layers
- Guided setup wizard

**17. Per-Resource Permissions**
- View/Comment/Edit/Admin per item
- Approval workflows
- Permission inheritance

**18. Multi-Org Support**
- Org switcher, guest accounts
- Cross-org sharing

**19. Advanced Features**
- Voice/live transcription (Gemini Live API)
- Canvas/whiteboard with AI assist
- Workflow builder (visual multi-step automations)
- Content marketplace (publish knowledge packs)
- Vertical templates (HR, support, research)

---

## Architecture Docs Index

| Doc | Status | What It Covers |
|-----|--------|---------------|
| **roadmap.md** (this doc) | Active | Master status + priorities |
| **chat/media-types.md** | Active | File support matrix per model |
| **chat/cost-observability.md** | Active | Per-message cost tracking, TTFT, cache |
| **chat/context-engineering.md** | Active | System prompt caching, compaction |
| **chat/local-models.md** | Active | Ollama integration, model detection |
| **integrations/connector-persistence.md** | Active | MCP ConnectionManager, OAuth refresh |
| **notifications/notification-events.md** | Active | Notification types and delivery |
| **platform/brand-guide.md** | Active | Colors, fonts, NeuralMorph, patterns |
| **platform/mobile-app.md** | Active | Capacitor iOS/Android setup |
| **platform/tool-result-cards.md** | Active | Tool output card component |
| **registries/tool-registry.md** | Active | Built-in tool catalog + MCP |
| **registries/db-schema-reference.md** | Active | Database tables and relationships |
| **library-hub-and-sharing.md** | Active | Library as central hub vision |
| **content-organization.md** | Active | Collections, tags, smart filters |
| **universal-artifact-system.md** | Active | Artifact storage, versioning, sandbox |
| **ingestion-pipeline.md** | RFC | Queue-based ingestion redesign |
| **sharing-permissions.md** | RFC | Per-resource permissions model |
| **org-permissions-system.md** | Proposal | Multi-org, roles, guests |
