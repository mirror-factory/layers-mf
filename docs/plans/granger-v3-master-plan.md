# Granger v3 — Master Plan

> Session: 2026-03-31
> Builder: Alfonso with Claude Code (Opus 4.6, 1M context)
> Status: Planning — review before agent execution

---

## Overview

Granger v3 is about three things:
1. **Polish & Unify** — fix the UI, make everything consistent, mobile-ready
2. **Architecture** — unified artifacts, repo ingestion, cost tracking, SDK packaging
3. **Infrastructure** — testing, documentation, registries, observability

---

## Part 1: UI Polish & Unification

### 1.1 Layout & Navigation Fixes
- [ ] Sidebar height overflow — scrolls beyond content, broken on certain heights
- [ ] Mobile optimization — responsive sidebar, bottom nav on mobile, touch-friendly
- [ ] Chat should be the default landing page (not Home)
- [ ] Open to new chat view every time
- [ ] Context Library demoted from homepage — accessible via sidebar

### 1.2 Welcome/Dashboard Screen
- [ ] Beautiful greeting view with blurred landscape image + glass overlay
- [ ] "Open Granger" or "Get up to date" CTA button
- [ ] Quick status cards: scheduled tasks, unread emails, pending approvals, recent meetings
- [ ] Pulls from connected services (Gmail, Linear, Granola, etc.)
- [ ] Tap to open → goes to chat
- [ ] Time-of-day greeting ("Good morning, Alfonso")

### 1.3 Settings Reorganization
- [ ] Dedicated section: Profile, Team, Organization, Permissions
- [ ] Currently scattered across /settings/profile, /settings/team, /settings/permissions
- [ ] Unified settings hub with clear navigation
- [ ] Each settings page has an explainer panel

### 1.4 Explainer Panels — Every Page
Pages that still need explainers or better ones:
- [ ] Home/Dashboard — what Granger can do
- [ ] Context Library — how documents are organized, how search works
- [ ] Approvals — what the approval queue is, how it works
- [ ] Inbox — what goes in here, when to check it
- [ ] Schedules — how cron jobs work, how to create one
- [ ] Sandbox — what sandboxes are, templates, snapshots, costs
- [ ] Integrations — how Nango connections work vs MCP

Pages with existing explainers (review for completeness):
- [x] Chat — built-in prompts
- [x] Skills — "How Skills Work"
- [x] MCP Servers — "How MCP Works" + marketplace
- [x] Sharing — "How Sharing Works"
- [x] Priority & Rules — "How Priority Documents & Rules Work"
- [x] AI Costs — "How AI Costs Work"
- [x] Chat SDK — feature matrix + setup guides
- [x] Team — "How Your Organization Works"
- [x] How It Works — full 9-section architecture page

### 1.5 shadcn/ui Consistency Audit
- [ ] Audit all components against shadcn/ui patterns
- [ ] Replace custom buttons/inputs with shadcn equivalents
- [ ] Consistent spacing, typography, color usage
- [ ] Dark mode review — ensure all pages look correct
- [ ] Use shadcn skill for validation

---

## Part 2: Unified Artifact System (PROD-251)

### 2.1 Database
```sql
artifacts (id, org_id, type, title, current_version, metadata, created_at, updated_at)
artifact_versions (id, artifact_id, version, content, snapshot_id, cost_usd, created_by, created_at)
```

### 2.2 Artifact Types
- **sandbox** — React/Vite/Python apps with live preview + snapshots
- **document** — TipTap rich text with AI inline editing
- **code** — standalone code files
- **csv** — data tables
- **image** — generated or uploaded images
- **repo** — ingested GitHub repositories

### 2.3 Artifact Panel
- Version history sidebar (scrollable, click to view/restore)
- Diff view between versions (for text/code types)
- Auto-versioning on save (debounced)
- Works identically across all types
- Collapsible file tree (already built for sandbox)

### 2.4 Artifacts Page (/artifacts)
- Grid/list view of all artifacts
- Filter by type, search by title
- Cost badge on each card
- Quick actions: open, duplicate, delete, share

---

## Part 3: GitHub Repo Ingestion (PROD-252)

### 3.1 Ingest to Context Library
- `/github ingest owner/repo`
- Clone in sandbox → read files → save to context_items
- Skip: node_modules, .git, binaries, large files
- Create embeddings for semantic search

### 3.2 Run in Sandbox
- `/github run owner/repo`
- Clone → detect framework → read .env.example → ask_user for env vars
- Install deps → start dev server → live preview
- Snapshot saved → restartable

### 3.3 Private Repo Access
- Uses GitHub PAT from MCP server config
- Same token for clone, ingestion, and MCP tool calls

---

## Part 4: Sandbox AI Gateway (PROD-253)

### 4.1 Key Injection
- Inject `AI_GATEWAY_API_KEY` into sandbox env on create
- Generated code uses `@ai-sdk/gateway` with the injected key
- Skill/agent instructions tell model to use AI Gateway patterns
- Apps built in sandbox can call AI models immediately

### 4.2 Cost Attribution
- Tag sandbox AI calls with `sandbox:{artifactId}`
- Gateway tracks per-artifact AI usage
- Show in AI Costs dashboard under "Sandbox AI Usage"

### 4.3 Reusable AI Apps
- Save working sandbox apps to artifact library
- Restart anytime from snapshot
- Track lifetime cost: creation + compute + AI usage
- Share with team as a reusable tool

---

## Part 5: Cost & Observability (PROD-254)

### 5.1 Per-Artifact Lifetime Costs
- Every artifact tracks total_cost_usd
- Breakdown: creation tokens, edit tokens, compute, AI usage
- Cost badge on artifact cards
- "Most expensive artifacts" in AI Costs dashboard

### 5.2 System Prompt Observability
- Show exact token count of current system prompt
- Breakdown: base instructions, priority docs, rules, tool definitions, history
- Cost calculation per message at current model's rates
- Visible in chat UI (expandable debug panel)

### 5.3 Conversation Context Window
- Show token usage of current conversation
- Visual bar: [system prompt | history | tools | available]
- Compaction indicator: "X tokens saved by pruning"
- Manual compact button

### 5.4 AI Gateway Reporting
- Connect to Vercel AI Gateway Spend Reports API
- Real-time cost data by model, user, date
- Credit balance display
- Cost alerts when thresholds exceeded

---

## Part 6: Auto-Generated Slash Commands & Agent Registration

### 6.1 MCP Auto-Commands
- When MCP server connected → auto-create /servername slash command
- Command expands to: "Use [server] MCP tools: [tool1, tool2, ...]"
- Appears in slash menu with server icon
- Removed when server disconnected

### 6.2 Skill Auto-Commands
- Already works for installed skills
- Marketplace skills should also show available commands before install

### 6.3 Dynamic Registry
- All tools (built-in, MCP, skills) registered in one place
- Slash commands generated from registry
- Agent instructions reference registry, not hardcoded lists

---

## Part 7: Testing & Quality

### 7.1 Component Registry
- Registry of all UI components with: name, description, location, props, examples
- Storybook for visual component testing
- Each component has a story with variants

### 7.2 API Registry
- Registry of all API routes with: path, method, params, response shape, auth
- Auto-generated from route files (parse TypeScript types)
- Searchable — LLM can look up existing APIs before creating new ones

### 7.3 Testing Stack
- **Unit**: Vitest (already set up, 817 passing)
- **E2E**: Playwright for browser testing
- **Visual**: Storybook visual regression
- **API**: Integration tests for each route
- **Component**: Storybook interaction tests

### 7.4 CI/CD
- Run tests on every PR
- Visual diff reports
- Coverage tracking
- Deploy preview for PRs

---

## Part 8: Documentation System

### 8.1 Documentation Site
- Research open-source doc platforms: Fumadocs, Nextra, Mintlify, Starlight
- AI-powered search on the doc site
- Auto-generated API reference from code
- Component docs from Storybook
- Architecture docs from our plan files

### 8.2 Internal Registries (for CLAUDE.md)
Lightweight registries that help the LLM find things:
```markdown
## Component Registry
| Name | Location | Description | Tags |
|------|----------|-------------|------|
| ChatInterface | src/components/chat-interface.tsx | Main chat UI | chat, streaming, tools |
| TipTapEditor | src/components/tiptap-editor.tsx | Rich text editor | editor, documents, AI |
| MCPServerCard | src/components/mcp-server-card.tsx | MCP connection card | mcp, oauth, settings |
...

## API Registry
| Path | Method | Description | Auth |
|------|--------|-------------|------|
| /api/chat | POST | Agentic chat with tools | Supabase |
| /api/mcp/discover | POST | OAuth discovery proxy | Supabase |
| /api/sandbox/restart | POST | Restart sandbox from snapshot | Supabase |
...
```

### 8.3 Programmatic Doc Generation
- Parse all `src/app/api/**/route.ts` → generate API docs
- Parse all `src/components/*.tsx` → generate component docs
- Parse all migrations → generate DB schema docs
- Run on build, output to `docs/generated/`

---

## Part 9: SDK Packaging & Licensing

### 9.1 Research Areas
- Vercel AI Gateway + AI SDK Observability (Feb/Mar 2026 article)
- SDK licensing models: per-seat, per-org, usage-based, open-core
- How to package: npm package, template repo, CLI scaffolding
- What the SDK includes vs what stays proprietary

### 9.2 SDK Architecture
```
@granger/core          — chat engine, tool system, agent loop
@granger/ui            — React components (chat, artifacts, tools)
@granger/sandbox       — sandbox execution, snapshots, templates
@granger/mcp           — MCP connection, OAuth, marketplace
@granger/gateway       — AI Gateway integration, cost tracking
```

### 9.3 Licensing Questions
- Does it go through our API/pipeline? (SaaS model)
- Or self-hosted? (license key model)
- Can users bring their own AI Gateway key?
- How do we track usage for billing?
- What's the free tier?

### 9.4 Documentation for SDK Users
- Getting started guide
- Component API reference
- Tool creation guide
- MCP integration guide
- Deployment guide

---

## Part 10: Video Demo Feedback System (PROD-249)

### 10.1 Flow
1. GitHub push → Granger detects via MCP
2. Auto-creates Linear task: "Test [feature] at layers.hustletogether.com"
3. Notifies partners via Slack/Discord
4. Partners record 30s-10min voice memo / screen recording
5. Granger collects + summarizes feedback into Context Library

### 10.2 Dependencies
- GitHub MCP connection (done)
- Linear task auto-creation (built-in tool exists)
- Granola MCP for voice memos (connected)

---

## Part 11: Production Deployment (PROD-243)

### 11.1 Vercel
- [x] Project created (hustle-together/layers-mf)
- [ ] Env vars set (file on Desktop)
- [ ] Build passing (ignoreBuildErrors enabled)
- [ ] Custom domain: layers.hustletogether.com

### 11.2 Auth
- [ ] Google OAuth redirect URI for production domain
- [ ] Supabase site URL + redirect URLs updated
- [ ] Test login flow end-to-end

### 11.3 Crons
- [ ] Only daily crons on Hobby plan
- [ ] Upgrade to Pro for sub-daily crons (schedules, linear-check, etc.)

### 11.4 Post-Deploy
- [ ] Discord bot interactions URL
- [ ] MCP OAuth callback URL
- [ ] Verify all API routes work

---

## Things Not Yet Mentioned But Should Consider

### Context Compaction Research
- How Claude Code does it (message summarization)
- How Vercel AI SDK's pruneMessages works (already using)
- Token-based sliding window vs semantic compaction
- Research: can we summarize old turns instead of dropping them?

### Multi-User Real-Time Chat
- @mention team members in conversations
- Real-time presence (who's online)
- Shared cursor in TipTap documents (collaboration)
- Supabase Realtime for WebSocket connections

### Desktop App (Electron/Tauri)
- Native desktop notifications (not just browser)
- System tray icon
- Keyboard shortcuts
- Offline mode with sync

### Mobile App
- React Native or PWA
- Push notifications
- Voice input for chat
- Camera for document scanning

### Audit & Compliance
- Full audit log of all actions
- Data export for compliance
- GDPR data deletion
- Role-based access control (RBAC) beyond current owner/admin/member

---

## Priority Order for Next Session

1. **Sandbox fixes** (Vite allowedHosts ✅, HOST=0.0.0.0 ✅, restart reliability)
2. **UI Polish** — sidebar height, mobile, welcome dashboard
3. **Unified Artifacts** — DB + versioning + artifact page
4. **System Prompt Observability** — token counter, cost overlay
5. **Repo Ingestion** — clone + run in sandbox
6. **Sandbox AI Gateway** — inject key, build AI apps
7. **Testing Setup** — Storybook, Playwright, registries
8. **Documentation System** — doc site + auto-generated docs
9. **SDK Packaging** — research + architecture
10. **Production Deploy** — Vercel + auth + crons
