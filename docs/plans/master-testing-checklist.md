# Granger Master Testing Checklist

> **Run every feature across the test matrix.** Log results back into this file and into `master-improvement-plan.md` eval log.
>
> Last updated: 2026-04-23

## Test Matrix

Every feature is tested across:
- **Devices**: desktop (1440×900) × mobile (iPhone 14 Pro 393×852) × tablet (iPad 820×1180)
- **Themes**: light × dark
- **Auth states**: logged-in × logged-out (where applicable)
- **Orgs**: solo × multi-user org

**That's 12 variants per feature.** Expect tests run all 12 automatically via matrix config.

## How to Run

```bash
# Start dev server (terminal 1)
pnpm dev

# Run expect tests (terminal 2)
EXPECT_BASE_URL=http://localhost:3000 npx expect-cli \
  --agent claude \
  -m "$(cat docs/plans/expect-plans/<feature>.md)" \
  -y
```

Screenshots go to `expect-out/<feature>/<device>-<theme>.png`.

---

## Feature Areas (the user's priority list)

### 1. Chat 🎯

**Core flows**
- [ ] Send text message → receive streamed response with tool calls
- [ ] Send message with @ mention → picker opens, selects person/doc
- [ ] Stop generation mid-stream → state recovers
- [ ] Branch conversation → new thread forks cleanly
- [ ] Share conversation → link works for recipient
- [ ] Export conversation (Markdown + JSON)
- [ ] Context window bar updates accurately
- [ ] Source citations render with relevance scores
- [ ] Tool call cards expand/collapse
- [ ] Code blocks syntax highlighted (Shiki)
- [ ] Multi-conversation history persists
- [ ] Model selector changes active model
- [ ] Slash commands: `/doc`, `/schedule`, `/skill`, etc. autocomplete
- [ ] Ambient AI cards: accept / dismiss / modify

**Edge cases**
- [ ] Send 50+ messages → compaction kicks in
- [ ] Paste 100k token doc → context-aware trimming
- [ ] Network drop mid-stream → resumable-streams recovers
- [ ] Tool errors render gracefully, not as crashes
- [ ] Concurrent messages from two users in multi-user chat

**AI-controllable** (principle #4)
- [ ] AI can open a specific conversation via tool
- [ ] AI can search chat history via tool
- [ ] AI can branch the current conversation via tool
- [ ] AI can share the current conversation via tool

### 2. Scheduling ⏰

- [ ] Create schedule via chat (`schedule_action` tool)
- [ ] Create schedule via UI (`/schedules` page)
- [ ] Timezone-aware display ("every morning 7am" honors user TZ)
- [ ] Run Now button triggers executor
- [ ] Scheduled run creates conversation with `initiated_by=schedule`
- [ ] Conversation appears in chat list with ⏰ icon
- [ ] Browser notification fires on completion
- [ ] Notification click → opens the specific chat
- [ ] Edit schedule: cron, tool_tier (minimal/standard/full), name
- [ ] Delete schedule → stops future runs
- [ ] Cron expression validator catches typos
- [ ] Schedule history shows past runs with duration + cost

### 3. Library 📚

*Note: Library is being rebuilt (see Sprint D). Tests below cover current state + target state.*

**Current state**
- [ ] Browse items by source (Drive, GitHub, Slack, Granola, Linear, Discord, Notion, upload)
- [ ] Filter by content type
- [ ] Search (hybrid: vector + BM25)
- [ ] Open item detail → title, summaries, entities, versions
- [ ] Upload PDF/DOCX/TXT/MD → pipeline processes
- [ ] Auto-embedded artifacts + chat summaries show up
- [ ] Tag items
- [ ] Share item with user/org
- [ ] Version history → restore previous version
- [ ] Bulk operations (delete, tag, share)

**Target state (after D3)**
- [ ] Top-level: Files / Photos / Notes / MCP Sources / Conversations
- [ ] Each source type has purpose-built detail view
- [ ] MCP sources route through the owning server, not local storage
- [ ] Photos get image-specific UI (grid, lightbox)

**AI-controllable**
- [ ] AI can search library via `search_context`
- [ ] AI can retrieve item by ID via `get_document`
- [ ] AI can navigate to folder via tool
- [ ] AI can create/rename/tag items via tool

### 4. MCPs 🔌

- [ ] Browse curated + official + Smithery registries
- [ ] Add server via URL + API key
- [ ] Add server via OAuth (post-deploy)
- [ ] Auto-discover tools from connected server
- [ ] Server tools merge into agent toolset in chat
- [ ] Disconnect server → tools removed from chat
- [ ] Health check cron pings every hour
- [ ] Server down → notification fires, red indicator on /mcp
- [ ] **Safety review**: new server triggers agent review → checkmark animation on pass
- [ ] Setup assistant walks user through provider account creation

**AI-controllable**
- [ ] AI can search MCP registry via tool
- [ ] AI can connect server via tool
- [ ] AI can disconnect server via tool
- [ ] AI can trigger health check via tool

### 5. Skills 🧠

- [ ] Browse 6 built-in + 23 marketplace skills
- [ ] Activate skill → prompt-extension applied to system prompt
- [ ] Create skill via multi-step wizard
- [ ] Create skill via chat (Tool Creation Skill interview)
- [ ] Create skill from code (test in sandbox → save)
- [ ] Skill with reference files → files load into context on activation
- [ ] **Safety review**: new skill triggers agent review → checkmark animation on pass
- [ ] Dynamic slash commands from active skills work

**AI-controllable**
- [ ] AI can activate skill via tool
- [ ] AI can create skill via tool
- [ ] AI can create tool-from-code via tool
- [ ] AI can search skills marketplace via tool

### 6. Artifacts 🎨

**Code artifacts**
- [ ] `write_code` displays code with syntax highlight
- [ ] `run_code` executes single file in sandbox
- [ ] `run_project` executes multi-file (filesystem + npm install)
- [ ] Artifact panel opens on right
- [ ] File tree navigates multi-file project
- [ ] Tabs: Code / Preview / Live
- [ ] `edit_code` updates existing artifact with `editDescription` logged
- [ ] `artifact_version` shows history, restore previous
- [ ] Persistent snapshot: 2nd run skips `npm install`

**Document artifacts (TipTap)**
- [ ] `create_document` opens TipTap artifact
- [ ] Auto-save every 3s creates version
- [ ] Highlight text → bubble menu appears
- [ ] Bubble menu "✨ AI Edit" → prompt input above selection
- [ ] AI edit replaces only highlighted range, not whole doc
- [ ] Manual bold/italic/heading formatting works
- [ ] Version history sidebar → restore

**AI-controllable** (principle #4 — this is the big one)
- [ ] AI can open / close artifact panel
- [ ] AI can switch tabs (Code/Preview/Live)
- [ ] AI can highlight text ranges in TipTap
- [ ] AI can apply bold/italic/heading to ranges
- [ ] AI can insert text at cursor
- [ ] AI can delete ranges
- [ ] AI can undo/redo
- [ ] AI can save current state as version

### 7. Integrations & Tools 🛠️

Each tool has its own expect test. Tool coverage: 36 tools listed in `tools.ts`.

- [ ] `search_context` — hybrid search returns relevant chunks
- [ ] `get_document` — retrieves full doc by ID
- [ ] `schedule_action`, `list_schedules`, `edit_schedule`, `delete_schedule`
- [ ] `run_project`, `run_code`, `write_code`, `edit_code`
- [ ] `ingest_github_repo` — clones, parses, embeds
- [ ] `review_compliance` — security/legal review
- [ ] `artifact_list`, `artifact_get`, `artifact_version`, `artifact_delete`
- [ ] `ai_sdk_reference` — AI SDK docs lookup
- [ ] `artifact_panel` — opens panel
- [ ] `express` — ? (TBD)
- [ ] `web_browse` — fetches URL
- [ ] `list_approvals`, `propose_action`
- [ ] `web_search` — Perplexity via gateway
- [ ] `activate_skill`, `create_skill`, `create_tool_from_code`
- [ ] `search_skills_marketplace`, `search_mcp_servers`
- [ ] `connect_mcp_server`, `disconnect_mcp_server`, `list_mcp_servers`
- [ ] `create_document`, `edit_document`
- [ ] `ask_user` — pauses for user input
- [ ] `search_chat_history`, `branch_conversation`
- [ ] `weather` — utility

### 8. Cross-Platform 📱

- [ ] Mobile: chat input auto-expands, sends on Enter (not Shift+Enter)
- [ ] Mobile: artifact panel slides up from bottom
- [ ] Mobile: sidebar becomes bottom nav
- [ ] Mobile: library grid collapses to list
- [ ] Mobile: file upload via camera
- [ ] Tablet: split view chat + artifact
- [ ] iOS Safari: PWA install, push notifications via APNS
- [ ] Desktop keyboard shortcuts: cmd+k palette, cmd+/ help
- [ ] Dark mode: all pages — no contrast bugs, no white flashes

### 9. Auth & Billing 🔐

- [ ] Signup creates org via trigger
- [ ] Login + Google OAuth
- [ ] Password reset flow
- [ ] Stripe checkout → webhook → credit balance updated
- [ ] Credit deduction on AI calls
- [ ] Rate limiting per tier
- [ ] API key generate/revoke
- [ ] Subscription cancel

### 10. Collaboration 🤝

- [ ] Multi-user chat: 2 users in same conversation, both see updates
- [ ] Chat participants modal: add/remove, role change
- [ ] @ mention notifies user
- [ ] Share item → recipient sees in "Shared with Me"
- [ ] Permissions enforced: view / edit / admin

### 11. Analytics & Observability 📊

- [ ] `/analytics` KPI dashboard renders
- [ ] Cost dashboard: per model, per user, per tag, per day
- [ ] Sandbox usage shows CPU-ms + network bytes
- [ ] Gateway credit balance in sidebar
- [ ] Agent run tracking
- [ ] Audit log search + pagination

---

## Expect Test Plan Files

Each area has a dedicated expect plan at `docs/plans/expect-plans/<area>.md`:

- `expect-plans/chat.md`
- `expect-plans/scheduling.md`
- `expect-plans/library.md`
- `expect-plans/mcp.md`
- `expect-plans/skills.md`
- `expect-plans/artifacts.md`
- `expect-plans/mobile.md`
- `expect-plans/auth-billing.md`
- `expect-plans/collaboration.md`
- `expect-plans/analytics.md`

Run all:
```bash
pnpm expect:all          # runs every plan across matrix, logs to eval log
pnpm expect:scheduling   # single feature area
```

(Scripts to be added to `package.json` under Sprint F1.)

---

## Run History

| Date | Area | Plan | Device | Theme | Pass/Fail | Notes / Bugs |
|------|------|------|--------|-------|-----------|--------------|
| _pending first run_ | | | | | | |

---

## Self-Improvement Loop Integration

After each expect run:
1. Failures → new rows in `master-improvement-plan.md` feature matrix
2. Any "AI couldn't do X" → new row in AI Tool Coverage Matrix
3. Research any gap against latest Anthropic/OpenAI/Vercel patterns
4. Document findings in `docs/research/<topic>.md`
5. Cite research in plan; ship the fix; re-run expect

This is the flywheel.
