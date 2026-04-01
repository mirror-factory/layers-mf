# Session Handoff — 2026-03-31

> For the next Claude Code session picking up this work.
> Read this first, then `docs/plans/granger-v3-master-plan.md` for the full roadmap.

---

## What Is This Project?

**Granger** is an AI chief-of-staff platform built on Next.js 16, React 19, Supabase, and the Vercel AI SDK v6. It's a chat-based workspace where teams manage knowledge, run code, connect external services via MCP, and use AI agents for tasks across Linear, Gmail, Notion, Google Drive, Granola, and more.

**Owner**: Alfonso at Mirror Factory (mirror-factory org on GitHub)
**Repo**: `mirror-factory/layers-mf` (private)
**Stack**: Next.js 16 App Router, React 19, TypeScript, Tailwind v3, shadcn/ui, Supabase (Postgres + Auth), Vercel AI SDK v6, AI Gateway

---

## What Was Built This Session (2026-03-31)

### Features Built (13 original + 10 fixes/additions)
1. MCP OAuth fix — auto-discovery, PKCE, dynamic client registration (Granola works)
2. GitHub MCP connected — 44 tools via PAT, /github slash command
3. Persistent Sandboxes — snapshots, CPU/network tracking
4. File Uploads to Chat — drag-drop, paperclip, previews
5. Reference Files in Skills — JSONB column, context loading
6. Sandbox Cost Tracking — usage table, cost computation
7. AI Gateway Observability — cost dashboard, user/tags
8. TipTap Document Editor — full toolbar, AI bubble menu, page styling
9. Skills Editor — file tree, TipTap editing, AI-assisted
10. ask_user Interview Tool — client-side tool for structured questions
11. skills.sh Live Search — API proxy, install button
12. Chat SDK Integrations — Discord/Slack/webhook setup page
13. Priority Documents & Rules — system prompt management
14. Sharing Tab — conversations, context, skills
15. MCP Marketplace — recommended servers + searchable registry + one-click install
16. How It Works page — 9-section architecture explainer
17. Conversation Pruning — pruneMessages for token savings
18. Project Templates — Vite scaffolding for React/Python
19. Sandbox Restart — from snapshot with loading UI
20. Python Auto-Install — detect imports, pip install

### DB Migrations Applied (5)
- `mcp_oauth_config` — OAuth fields on mcp_servers
- `sandbox_snapshots` — VM state persistence
- `skills_reference_files` — JSONB on skills
- `rules` — user-defined behavior constraints
- `sandbox_usage` — compute cost tracking

### Key Files to Know
| What | Where |
|------|-------|
| Chat route (agent, tools, system prompt) | `src/app/api/chat/route.ts` |
| All tools (30+) | `src/lib/ai/tools.ts` |
| Chat UI (artifact panel, slash commands) | `src/components/chat-interface.tsx` |
| Sandbox execution | `src/lib/sandbox/execute.ts` |
| MCP connection + OAuth | `src/lib/mcp/connect.ts` |
| MCP server card (OAuth UI) | `src/components/mcp-server-card.tsx` |
| MCP page (marketplace) | `src/app/(dashboard)/mcp/page.tsx` |
| MCP discover proxy | `src/app/api/mcp/discover/route.ts` |
| MCP registry API | `src/app/api/mcp/registry/route.ts` |
| TipTap editor | `src/components/tiptap-editor.tsx` |
| Interview UI (ask_user) | `src/components/interview-ui.tsx` |
| Priority docs loader | `src/lib/ai/priority-docs.ts` |
| Skills registry | `src/lib/skills/registry.ts` |
| How It Works page | `src/app/(dashboard)/how-it-works/page.tsx` |

---

## Known Issues (Not Yet Fixed)

1. **Sandbox restart sometimes shows 502** — Vite dev server needs time to bind. We set HOST=0.0.0.0 and poll for 60s, but large projects may still timeout. Consider using `vite preview` (static build) instead of `vite dev` for restarts.

2. **Pre-existing TypeScript errors** — ~25 errors from Supabase generated types being out of sync with migrations. Fix: run `pnpm supabase gen types typescript --project-id fenhyfxbapybmddvhcei > src/lib/database.types.ts`. Build set to `ignoreBuildErrors: true` for now.

3. **AI Costs dashboard** — "Failed to load" for gateway costs because we don't have a `usage_logs` table. The gateway API endpoint exists but needs to be connected to real Vercel Gateway Spend Reports API.

4. **Skills Editor** — clicking files in the tree can error if the skill has no system_prompt. Need null checks.

5. **Inbox** — empty because crons don't run in dev. Will populate after Vercel production deploy.

6. **Vercel deployment** — project exists at hustle-together/layers-mf, env vars need to be added via UI (file at ~/Desktop/vercel-env.txt), build passes with ignoreBuildErrors.

---

## What's Planned Next (v3 Master Plan)

Full plan at: `docs/plans/granger-v3-master-plan.md`

### Sprint 1 Priority: Context Engineering
Alfonso's top priority is getting context management right. This means:
- Token counter showing exact breakdown per message
- Context window visualization (used vs available)
- Smart compaction research (Claude Code approach vs sliding window vs semantic)
- Context authoring system (preview how priority docs affect the prompt)
- Embedding benchmarks (Gemini vs OpenAI)

### Sprint 2: UI Polish
- Sidebar height overflow fix
- Mobile optimization
- Welcome dashboard with greeting + status cards
- Settings reorganization
- Explainer panels on every page

### Sprint 3: Architecture
- Unified artifact system (versioned state for all types)
- Repo ingestion (clone GitHub repos into context library + sandbox)
- Sandbox AI Gateway (inject key for AI app development)
- Auto slash commands from MCP connections

### Sprint 4+: Infrastructure & SDK
- Testing (Storybook, Playwright, registries)
- Documentation site
- SDK packaging research
- Production deploy

---

## Important Patterns & Conventions

- **All AI calls go through Vercel AI Gateway** — never direct provider SDKs
- **Only 3 providers**: Anthropic, OpenAI, Google (via gateway)
- **AI SDK v6**: `tool()` uses `inputSchema:` NOT `parameters:` (breaking change from v5)
- **Supabase admin client**: use `createAdminClient()` to bypass RLS, cast as `any` for untyped tables
- **Node path**: `/opt/homebrew/bin/node` (not on PATH in bash)
- **pnpm**: preferred package manager
- **Pre-commit/push hooks**: relaxed to warn on pre-existing errors
- **Local docs**: `docs/ai-sdk/`, `docs/ai-gateway/`, `docs/ai-elements/` — always consult before coding

---

## Linear Project

**Project**: [Granger v2 — Next Features](https://linear.app/mirror-factory/project/granger-v2-next-features-34535fc5c13a)
**Team**: Product (PROD)

### Open Issues
| Issue | Title | Status |
|-------|-------|--------|
| PROD-243 | Production Deployment Checklist | Backlog |
| PROD-248 | MCP Library — GitHub/Vercel/Linear | Backlog |
| PROD-249 | Video Demo Feedback System | Backlog |
| PROD-250 | MCP Marketplace | Done |
| PROD-251 | Unified Artifact System | Backlog |
| PROD-252 | GitHub Repo Ingestion | Backlog |
| PROD-253 | Sandbox AI Gateway | Backlog |
| PROD-254 | Artifact Lifetime Cost Tracking | Backlog |

### Completed This Session
PROD-234 through PROD-247 (13 features), plus PROD-244, PROD-250.
