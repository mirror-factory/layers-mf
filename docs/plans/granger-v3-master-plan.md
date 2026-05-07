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

### 9.1 The Vision
Package Granger as an SDK that other teams/companies can use to build their own AI chief-of-staff / knowledge platform. They get the same chat, tools, MCP, sandbox, artifacts system — customized for their org.

### 9.2 Research Required

**Vercel AI Gateway Observability Article (Feb/Mar 2026)**
- Research the specific article about AI Gateway cost visibility
- Understand: what observability does the gateway provide out of the box?
- What can we build on top of it for our SDK users?
- How does per-tenant cost tracking work when multiple SDK users share a gateway?

**Business Model Options**
| Model | How It Works | Revenue | Our Control |
|-------|-------------|---------|-------------|
| **SaaS (hosted)** | Users sign up on our platform, we host everything | Monthly subscription | Full — we manage infra |
| **SDK + our Gateway** | Users self-host the app, but AI calls go through our AI Gateway | Usage-based (per token) | Medium — we see all AI usage |
| **SDK + their Gateway** | Users self-host everything, bring their own AI Gateway key | License fee (per seat/org) | Low — we don't see usage |
| **Open Core** | Core is open source, premium features are paid | License + support | Low — community forks |
| **Managed SDK** | We give them a Next.js template, they deploy to their Vercel, but config calls our API | Hybrid (license + usage) | Medium |

**Key Question**: If someone starts a new Next.js project with our SDK, what's the experience?
```
npx create-granger-app my-company
  → Scaffolds Next.js + Supabase + AI Gateway
  → Asks for: AI Gateway key, Supabase URL, org name
  → Deploys to Vercel
  → They get: chat, tools, MCP, sandbox, artifacts
  → We get: usage tracking via gateway tags
```

### 9.3 SDK Package Architecture
```
@granger/core
  ├── chat engine (ToolLoopAgent, streaming, pruneMessages)
  ├── tool system (tool registry, built-in tools, MCP loader)
  ├── context management (priority docs, rules, compaction)
  ├── auth (Supabase integration, org/team/member)
  └── types (shared TypeScript types)

@granger/ui
  ├── ChatInterface (full chat with slash commands, file upload)
  ├── ArtifactPanel (code viewer, TipTap editor, sandbox preview)
  ├── InterviewUI (ask_user tool rendering)
  ├── MCPMarketplace (server discovery, OAuth connect)
  ├── SkillsBrowser (skills.sh search, install)
  └── CostsDashboard (AI costs, sandbox costs)

@granger/sandbox
  ├── executeInSandbox / executeProject
  ├── snapshot management
  ├── template system (react, vite, python)
  ├── restart from snapshot
  └── cost tracking

@granger/mcp
  ├── MCP connection (createMCPClient)
  ├── OAuth discovery + PKCE
  ├── Dynamic client registration
  ├── Registry search API
  └── Auto slash command generation

@granger/gateway
  ├── AI Gateway integration (@ai-sdk/gateway wrapper)
  ├── Per-tenant cost tracking (user/org tags)
  ├── Model routing (9-model matrix)
  ├── Spend reports API
  └── Credit system
```

### 9.4 What Goes Through Our Pipeline?
Two options for SDK users:

**Option A: They use our AI Gateway**
- All AI calls routed through our Vercel AI Gateway
- We track usage per tenant automatically
- We bill based on token usage (markup on provider costs)
- They don't need their own OpenAI/Anthropic/Google keys
- We handle rate limiting, model routing, fallbacks
- **Pro**: simple for them, predictable revenue for us
- **Con**: they depend on our uptime, data goes through us

**Option B: They bring their own keys**
- They set up their own AI Gateway (or use providers directly)
- They manage their own costs
- We charge a flat license fee (per seat or per org)
- They report usage back to us (or we trust them on honor system)
- **Pro**: no data dependency, they control costs
- **Con**: harder to monetize, no usage visibility

**Recommended**: Option A as default, Option B as enterprise tier.

### 9.5 How Do We Know They're Using It?
- **Gateway approach**: every AI call has `x-granger-tenant-id` header → we see all usage
- **License key approach**: SDK phones home on startup, reports active users monthly
- **Telemetry approach**: anonymous usage stats (feature usage, not content) sent to our analytics
- **Audit approach**: SDK checks license validity on each deploy (like Vercel's license check)

### 9.6 What Needs To Be Built for SDK
1. **Tenant isolation** — multi-tenant Supabase (RLS already does this via org_id)
2. **Config system** — SDK users configure via `granger.config.ts` (models, tools, theme, etc.)
3. **Theming** — CSS variables for branding (already using Tailwind + CSS vars)
4. **Tool SDK** — clean API for creating custom tools (`granger.defineTool({...})`)
5. **Plugin system** — extend with custom pages, components, integrations
6. **CLI** — `npx create-granger-app`, `granger add tool`, `granger deploy`
7. **Admin dashboard** — for us to see all tenants, usage, costs, health

### 9.7 Documentation for SDK Users
- Getting started guide (5 min to first chat)
- Architecture overview (how the pieces connect)
- Component API reference (auto-generated from TypeScript)
- Tool creation guide (with examples)
- MCP integration guide (connect external services)
- Deployment guide (Vercel + Supabase + Gateway setup)
- Customization guide (theming, branding, custom pages)
- Cost management guide (model selection, token optimization)
- Migration guide (from v2 to v3, breaking changes)

### 9.8 Competitive Landscape Research
- How does v0 package their components? (open source? SDK?)
- How does Cursor monetize? (subscription + usage)
- How does Vercel AI SDK itself license? (open source, gateway is paid)
- How does Supabase license? (open core, hosted is paid)
- What's the market for "AI workspace SDKs"?
- Who would buy this? (agencies, startups, enterprises building internal tools)

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

### Context Engineering (Critical — Alfonso's Priority)

**This is foundational.** Every piece of the platform depends on context management being right.

#### What We Have Now
- `pruneMessages` from AI SDK v6: strips old tool calls after 2 turns, removes reasoning
- Priority documents: 5-10 docs always in system prompt
- Rules: hard constraints appended to system prompt
- Tool definitions: ~50-150 tokens each, sent every request
- Conversation history: persisted in DB, loaded on chat open
- `logUsage()` writes to `usage_logs` table with inputTokens/outputTokens per request
- `onStepFinish` callback in ToolLoopAgent tracks usage per step

#### Research Findings (2026-03-31)

**AI SDK v6 offers:**
- `pruneMessages()` with per-tool granularity: `[{ type: 'before-last-message', tools: ['search'] }]`
- `convertToModelMessages()` for UIMessage → ModelMessage conversion
- `validateUIMessages()` to check loaded messages against current tool schemas
- Language model middleware (`wrapGenerate`, `wrapStream`) for custom interceptors
- NO built-in token counting utility
- NO built-in conversation summarization middleware
- NO automatic context window management in ToolLoopAgent

**Gateway provides per-request:**
- `experimental_providerMetadata.gateway.cost` — actual USD cost
- `experimental_providerMetadata.gateway.marketCost` — market rate
- `experimental_providerMetadata.gateway.generationId` — unique request ID
- `experimental_providerMetadata.gateway.provider` — which provider served it
- NO aggregate spend reports API (must build from usage_logs)
- NO per-user tags in gateway (must track in our own DB)

#### Implementation Plan

**1. Token Counter (can build now)**
- No SDK utility exists — estimate tokens as `Math.ceil(text.length / 4)` (rough but workable)
- For precise counting: use `tiktoken` npm package for OpenAI, Anthropic's tokenizer for Claude
- Show breakdown in an expandable debug panel below the chat input
- Calculate cost using model pricing from `src/lib/ai/config.ts`

**2. Context Window Visualization (can build now)**
- Visual bar in chat UI: `[system: X | docs: Y | rules: Z | tools: W | history: H | available: A]`
- Color-coded segments with token counts
- Updates in real-time as you type / add priority docs
- Click to expand → see exact breakdown

**3. Smart Compaction (build custom middleware)**
- AI SDK has NO built-in summarization — we must build it ourselves
- Use `wrapGenerate` middleware pattern:
  1. Before each LLM call, check total message tokens
  2. If over threshold (e.g., 80% of context window), summarize old turns
  3. Use Haiku ($0.25/M input) to generate a 1-paragraph summary of turns 1-N
  4. Replace turns 1-N with the summary message
  5. Keep last 3 turns verbatim
- Middleware code pattern:
  ```typescript
  const compactionMiddleware = () => ({
    wrapGenerate: async ({ doGenerate, params }) => {
      const tokenEstimate = estimateTokens(params.prompt);
      if (tokenEstimate > MAX_CONTEXT * 0.8) {
        params.prompt = await compactHistory(params.prompt);
      }
      return doGenerate();
    }
  });
  ```

**4. Context Authoring System (can build now)**
- Already have Priority Docs + Rules UI
- Add: "Preview Prompt" button that shows the assembled system prompt
- Add: "Test Response" button that sends a test message and shows side-by-side comparison (with vs without the doc)
- Add: token cost estimate for each priority doc

**5. Tool Loading Optimization (research + build)**
- Current: ~3K tokens for 25+ built-in tools + 44 GitHub MCP tools = ~7K tokens/request
- **Per-tool pruneMessages**: strip MCP tool results aggressively (they're large)
  ```typescript
  pruneMessages({ toolCalls: [
    { type: 'before-last-message', tools: ['list_issues', 'get_file_contents'] }
  ]})
  ```
- **Two-pass routing** (future): meta-tool that picks service, then loads specific tools
- **Tool description compression**: shorten all descriptions to <20 words (saves ~30% tokens)

---

### Embedding System & Benchmarking

#### Current State (Researched 2026-03-31)
- **Model**: `openai/text-embedding-3-small` (1536 dimensions) via AI Gateway
- **Code**: `src/lib/ai/embed.ts` — `generateEmbedding()` and `generateEmbeddings()`
- **Search**: `src/lib/db/search.ts` — hybrid search (vector + BM25/RRF) via Supabase RPCs
- **Ingestion**: embeddings generated during upload, sync, and cron ingest
- **Cost**: 0.5 credits per embedding call, ~$0.02/M tokens for text-embedding-3-small
- **Eval files exist**: `src/lib/evals/retrieval.eval.ts`, `src/lib/evals/performance.eval.ts`

#### Available Models via AI Gateway
| Provider | Model | Dimensions | Cost |
|----------|-------|-----------|------|
| OpenAI | text-embedding-3-small | 1536 | $0.02/M tokens |
| OpenAI | text-embedding-3-large | 3072 | $0.13/M tokens |
| Google | gemini-embedding-001 | 3072 | ~$0.004/M tokens |
| Google | text-embedding-004 | 768 | ~$0.004/M tokens |
| Mistral | mistral-embed | 1024 | $0.10/M tokens |
| Cohere | embed-english-v3.0 | 1024 | $0.10/M tokens |

#### Switching is trivial:
```typescript
// Current
const model = gateway.textEmbeddingModel('openai/text-embedding-3-small');
// Switch to Google
const model = gateway.textEmbeddingModel('google/text-embedding-004');
```

**BUT**: Switching dimensions (1536 → 768) requires re-embedding ALL existing context_items and updating the Supabase vector index dimension. This is a migration, not a config change.

#### Benchmarking Plan
1. **Test dataset**: Select 50 queries from real chat history + 50 synthetic queries
2. **Ground truth**: Manually label which context_items should match each query
3. **Run both models** on the same queries against the same context_items
4. **Metrics**: precision@5, recall@5, MRR, latency, cost
5. **Script**: Python in sandbox, outputs CSV → visualize in a sandbox React chart
6. **Decision**: switch if Google is >10% better retrieval at lower cost

#### Benchmarking Framework (Reusable)
```typescript
interface Benchmark {
  name: string;
  testCases: { input: unknown; expectedOutput: unknown }[];
  run: (input: unknown) => Promise<unknown>;
  evaluate: (actual: unknown, expected: unknown) => number; // 0-1 score
}
```
- Store benchmark results in `benchmark_results` table
- Track over time (detect regression)
- `/benchmark` slash command triggers a run
- Research Agent skill designs and runs experiments

---

### Error Handling & Production Readiness

**Current gaps:**
- No global error boundary (React ErrorBoundary component)
- No error tracking service (Sentry, LogRocket, etc.)
- Silent failures throughout (fire-and-forget patterns everywhere)
- No user-facing error messages beyond generic "Failed to load"

**What to build:**
1. React ErrorBoundary wrapping the app layout
2. Sentry integration (free tier: 5K errors/month) or Vercel's built-in error tracking
3. Toast notifications for non-critical errors (already have sonner)
4. Error logging to a `error_logs` table for debugging
5. Retry logic for transient failures (MCP connections, sandbox starts)

### Security Hardening

**Current gaps:**
- OAuth tokens stored as plain text in `api_key_encrypted` column (not actually encrypted)
- No CSRF protection on form submissions
- No input sanitization beyond basic Zod validation
- GitHub PATs stored in DB alongside OAuth tokens

**What to build:**
1. Encrypt sensitive columns with Supabase Vault or application-level encryption
2. CSRF tokens on all mutation endpoints
3. Rate limiting on expensive operations (sandbox create, MCP connect, embedding generation)
4. Input length limits on all text fields (prevent prompt injection via large inputs)
5. Content Security Policy headers (already have basic ones in vercel.json)

### AI Costs Dashboard Fix

**Root cause found**: The `usage_logs` table EXISTS (migration 20260317020000) and `logUsage()` writes to it, but the AI Costs API route fails because:
1. The Supabase generated types don't include `usage_logs` (need to regenerate)
2. The API uses `supabase.from("usage_logs")` which TypeScript rejects at runtime with typed client

**Fix**: Use admin client (bypasses types) like other routes do, or regenerate Supabase types.

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

### Sprint 1: Foundation (Context + Observability)
1. **Context Engineering** — token counter, context window visualization, compaction research
2. **System Prompt Observability** — exact breakdown of what's being sent and what it costs
3. **Embedding Benchmarks** — Gemini vs OpenAI, build reusable benchmarking framework
4. **Component & API Registries** — lightweight registries in CLAUDE.md for LLM lookups

### Sprint 2: Polish & Architecture
5. **UI Polish** — sidebar height, mobile, welcome dashboard, settings reorganization
6. **Unified Artifacts** — DB + versioning + artifact page
7. **Sandbox Reliability** — restart fixes, Vite template refinement, snapshot persistence
8. **Explainer Panels** — every page gets one with examples

### Sprint 3: Capabilities
9. **Repo Ingestion** — clone + run in sandbox with env var interview
10. **Sandbox AI Gateway** — inject key for AI app development
11. **Auto Slash Commands** — MCP + skills auto-register commands
12. **Artifact Cost Tracking** — per-artifact lifetime costs

### Sprint 4: Infrastructure
13. **Testing Setup** — Storybook, Playwright, component stories, API tests
14. **Documentation System** — doc site (Fumadocs/Nextra), auto-generated API + component docs
15. **Production Deploy** — Vercel + Google Auth + Supabase + custom domain
16. **SDK Packaging Research** — licensing models, package architecture, business model

### Sprint 5: Growth
17. **Video Demo Feedback System** — GitHub push → Linear task → partner feedback
18. **Benchmarking Case Studies** — publish results as marketing content
19. **Multi-User Chat** — @mentions, presence, real-time collaboration
20. **Mobile/Desktop Apps** — PWA or native for push notifications + offline
