# Granger Master Improvement Plan

> **Central source of truth.** Every feature iteration, every eval run, every research finding logs back here.
> Last updated: 2026-04-23
> Owner: Alfonso + Claude (continuous self-improvement loop)

## Vision

Granger is an AI chief of staff that works on phone, desktop, browser — with shared orgs, shared context, and an embedding-powered library. The north star: **AI can do everything a human can do with their finger** — open/close artifacts, highlight text, bold selections, navigate the library, connect MCPs, create skills. Every UI element is AI-controllable.

## Guiding Principles

1. **Retrieval-led reasoning** — consult local docs (`docs/ai-sdk`, `docs/ai-gateway`, `docs/ai-elements`) and the skill registry BEFORE writing code
2. **AI Gateway only** — all AI calls route through Vercel AI Gateway (`@ai-sdk/gateway`). Never direct provider SDKs. Only OpenAI, Anthropic, Google.
3. **Every feature is testable** — shipped means expect-tested on desktop + mobile × light + dark
4. **Every UI is AI-controllable** — if a human can do it, an AI tool can trigger it
5. **Self-improvement loop** — research best practices (Anthropic, OpenAI, Vercel) → document → implement → test → log findings back here

---

## Feature Roadmap

Status legend: 🟢 shipped | 🟡 in-progress | 🔴 not started | 🔵 blocked

### Sprint A — Scheduling & Notifications (THIS WEEK)

| # | Feature | Status | Eval? | Notes |
|---|---------|--------|-------|-------|
| A1 | Scheduled tasks → chat conversations (`initiated_by`, `schedule_id`) | 🟡 schema+executor exist, UI incomplete | 🔴 | Migrations `20260331030000`, `20260331040000` |
| A2 | Timezone-aware scheduling | 🟡 column exists, croner integration incomplete | 🔴 | `partner_settings.timezone` |
| A3 | Browser notifications for all AI activity | 🟡 partial — scheduled chats + approvals in poll | 🔴 | Expand to tool executions |
| A4 | Notification → specific chat deep-link | 🔴 | 🔴 | `/chat?id=<conversation_id>` |
| A5 | MCP server health monitoring cron | 🔴 | 🔴 | Every 1h ping, `last_connected_at` |

### Sprint B — Artifacts & AI Control (NEXT)

| # | Feature | Status | Eval? | Notes |
|---|---------|--------|-------|-------|
| B1 | TipTap document artifact (bubble-menu AI edit) | 🔴 | 🔴 | See `next-features.md` #9 |
| B2 | AI-controllable artifact UI primitives (open/close/highlight/format) | 🔴 | 🔴 | **Core principle #4** — AI tool coverage for every interaction |
| B3 | File uploads to chat (images, PDFs, docs) | 🔴 | 🔴 | AI SDK v6 `FileUIPart` |
| B4 | Persistent sandbox snapshots | 🔴 | 🔴 | `sandbox.snapshot()` + `sandbox_snapshots` table |

### Sprint C — Skills & MCP Safety (NEXT+1)

| # | Feature | Status | Eval? | Notes |
|---|---------|--------|-------|-------|
| C1 | Skills/MCP safety review agent (with checkmark animation) | 🔴 | 🔴 | Gemini-Flash review before activation |
| C2 | MCP OAuth end-to-end (post-deploy) | 🔴 🔵 | 🔴 | Needs production URL |
| C3 | Tool Creation Skill (interview UI) | 🔴 | 🔴 | AI SDK client-side tool, no execute |
| C4 | Reference files in skills | 🔴 | 🔴 | `reference_files` JSONB |
| C5 | MCP setup assistant (guides user to create account at each provider) | 🔴 | 🔴 | Per-MCP onboarding flow |

### Sprint D — Library Rebuild (RESEARCH FIRST)

| # | Feature | Status | Eval? | Notes |
|---|---------|--------|-------|-------|
| D1 | Research: how should library be structured for mixed MCP/file/artifact/conversation sources? | 🔴 | — | See `docs/research/library-architecture.md` |
| D2 | Pull back library to "files & photos" base until structure solid | 🔴 | 🔴 | Simplify first, expand with clarity |
| D3 | Source-aware library: Files / Photos / Notes / MCP Sources / Conversations | 🔴 | 🔴 | After D1 |
| D4 | Embedding-powered search with source-type filters | 🟢 mostly done | 🔴 | Needs expect tests |

### Sprint E — Observability & Cost

| # | Feature | Status | Eval? | Notes |
|---|---------|--------|-------|-------|
| E1 | AI Gateway observability + cost dashboard (`/analytics/costs`) | 🟡 API route exists | 🔴 | |
| E2 | Sandbox cost tracking (`sandbox_usage` table) | 🟡 table exists | 🔴 | Wire into execute path |
| E3 | Per-user/per-tag cost attribution via `providerOptions.gateway` | 🔴 | 🔴 | Add to chat route |

### Sprint F — Self-Improvement Loop

| # | Feature | Status | Eval? | Notes |
|---|---------|--------|-------|-------|
| F1 | `/self-improve` slash command | 🔴 | — | Runs test matrix, researches web, updates plan |
| F2 | PostToolUse hook that triggers eval on `Write`/`Edit` to critical paths | 🔴 | — | Via `.claude/settings.json` hooks |
| F3 | Weekly research digest: Anthropic MCP registry, OpenAI Plugins, Vercel AI Elements releases | 🔴 | — | Cron → context_items |

---

## AI Tool Coverage Matrix (Principle #4)

> If a human can do it with their finger, an AI tool must be able to trigger it.

| UI Surface | Human Action | AI Tool | Status |
|------------|--------------|---------|--------|
| Chat | Open conversation | `open_conversation` | 🔴 missing |
| Chat | Branch thread | `branch_conversation` | 🟢 |
| Chat | Share conversation | `share_conversation` | 🔴 missing |
| Chat | Stop generation | `stop_generation` | 🔴 missing (UI only) |
| Artifact panel | Open panel | `artifact_panel` | 🟢 |
| Artifact panel | Close panel | `artifact_panel_close` | 🔴 missing |
| Artifact panel | Switch tab (Code/Preview/Live) | `artifact_view` | 🔴 missing |
| TipTap editor | Highlight text | `doc_highlight_selection` | 🔴 |
| TipTap editor | Bold/italic selection | `doc_format_selection` | 🔴 |
| TipTap editor | Insert heading | `doc_insert_heading` | 🔴 |
| TipTap editor | Replace range | `doc_replace_range` | 🔴 |
| Library | Navigate to folder | `library_navigate` | 🔴 |
| Library | Create folder | `library_create_folder` | 🔴 |
| Library | Rename item | `library_rename` | 🔴 |
| Library | Tag item | `library_tag` | 🔴 |
| MCP page | Connect server | `connect_mcp_server` | 🟢 |
| MCP page | Disconnect | `disconnect_mcp_server` | 🟢 |
| MCP page | Trigger health check | `mcp_health_check` | 🔴 |
| Skills | Activate skill | `activate_skill` | 🟢 |
| Skills | Create skill | `create_skill` | 🟢 |
| Skills | Review skill safety | `review_skill_safety` | 🔴 |
| Settings | Change timezone | `settings_update_timezone` | 🔴 |
| Settings | Toggle theme | `toggle_theme` | 🔴 |

**Gap count: 17 missing tools.** Tracked as individual stories under Sprint B2.

---

## Research Log

Every iteration of this plan should cite new research here. Topic prompts:
- How does Anthropic's MCP registry curate safety? (link: https://modelcontextprotocol.io)
- How does OpenAI's plugin / GPT Store handle OAuth inline?
- How does Vercel AI Elements package Agent UI primitives? (link: AI Elements docs)
- What patterns do best-in-class "AI can see and click UI" products use? (v0, Cursor, Cline)
- Which Claude/GPT/Gemini models are optimal for each role (ambient, safety-review, document-edit, tool-routing)?

### 2026-04-23 — Initial research targets
- [ ] Read MCP registry safety guidelines
- [ ] Review Anthropic skill safety best practices
- [ ] Compare OpenAI Plugin manifest → our skill schema
- [ ] Benchmark Gemini-Flash-Lite vs Haiku for ambient-check latency/cost

---

## Eval Results Log

Every expect-test run logs here with date, feature, device, theme, pass/fail, bugs found.

| Date | Feature | Device | Theme | Pass | Bugs Found |
|------|---------|--------|-------|------|------------|
| _pending first run_ | | | | | |

---

## Change Log Discipline

After every push:
1. Update `src/data/changelog.ts` (user-facing)
2. Update this plan's feature matrix (status shifts)
3. Update eval log if tests ran
4. Spawn next research item if unblocked

---

## Linked Docs

- [Testing Checklist](./master-testing-checklist.md) — every feature × device × theme
- [Self-Improve Loop](./self-improve-loop.md) — how we iterate
- [Library Architecture Research](../research/library-architecture.md) — D1 output
- [Skills/MCP Safety Research](../research/skills-mcp-safety.md) — C1 input
- [AI Tool Coverage Stories](./ai-tool-coverage.md) — Sprint B2 detail
- [dev-status.md](../dev-status.md) — sprint tracking
- [next-features.md](./next-features.md) — original backlog
- [next-session-priorities.md](./next-session-priorities.md) — architectural improvements
- [migration-checklist.md](../migration-checklist.md) — DB migrations to apply
- [launch-checklist.md](../launch-checklist.md) — prod deployment
