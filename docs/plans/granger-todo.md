# Granger — Full TODO List

> Generated from notebook notes + session work on 2026-03-30
> Source: Alfonso's handwritten notebook + GRANGER-SPEC.md + testing results

---

## Status Legend
- [x] Done (built today)
- [ ] TODO
- [~] Partially done

---

## 1. Core Agent (DONE)

- [x] Priority document system (5 docs always in system prompt)
- [x] ToolLoopAgent with 10+ steps
- [x] Conversation history compaction (Claude Code-style)
- [x] Sub-agent architecture (5 specialist agents: Linear, Gmail, Notion, Granola, Drive)
- [x] Slash commands (/linear, /gmail, /notion, /granola, /drive, /schedule, /approve, /help)
- [x] 9-model matrix (3 providers × 3 tiers)
- [x] Per-partner API key support (gateway fallback)
- [x] Values-based conflict detection in agent instructions
- [x] DEMO_MODE credit bypass

## 2. Approval System (DONE)

- [x] propose_action tool routes writes through approval queue
- [x] Approval API (list, approve, reject)
- [x] Inline approval buttons in chat (Approve & Execute / Reject)
- [x] Execution on approve (calls Linear, Gmail APIs)
- [x] Approval results show clickable URLs (e.g., Linear issue link)
- [x] /approvals page with Pending/Reviewed/All tabs
- [ ] Approval history export
- [ ] Approval delegation (allow specific partners to auto-approve certain types)

## 3. Data Sources & API Clients (DONE)

- [x] Direct API client: Granola (meeting transcripts)
- [x] Direct API client: Linear (issues, projects, teams)
- [x] Direct API client: Discord (channels, messages)
- [x] Direct API client: Notion (pages, databases, block flattening)
- [x] Direct API client: Gmail (search, read, draft)
- [x] Direct API client: Drive (list, export Docs/Sheets/Slides)
- [x] Google OAuth callback route (shared Gmail + Drive auth)
- [x] Credentials table with org-level + user-level scoping
- [ ] Slack direct API client (replace Nango)
- [ ] GitHub direct API client (replace Nango)
- [ ] ClickUp API client
- [ ] Google Calendar API client (pre-meeting prep)
- [ ] Init of APIs with approval modes (from notebook)

## 4. Discord Bot (DONE)

- [x] Chat SDK integration (chat@4.23.0 + @chat-adapter/discord)
- [x] HTTP interactions endpoint (Ed25519 verification)
- [x] Slash commands: /ask, /status, /tasks, /digest
- [x] DM conversations
- [x] Approval reactions (✅/❌)
- [x] Thread responses
- [ ] Set up Discord bot application (needs bot token, public key)
- [ ] Register slash commands in production
- [ ] Create #granger-digest and #granger-alerts channels
- [ ] Gateway listener cron for @mention support (Chat SDK pattern)

## 5. Scheduled Actions (DONE)

- [x] scheduled_actions table + RLS
- [x] schedule_action tool (chat: "every morning check Linear")
- [x] /schedules page with Active/Paused/Completed tabs
- [x] Pause/resume toggle + delete
- [x] Run Now button per schedule
- [x] 5 default schedules seeded (Digest, Alerts, Granola, Synthesis, Linear Check)
- [x] Linear Status Check cron (every 3 min)
- [ ] Schedule executor service (actually runs scheduled_actions automatically)
- [ ] Cron expression editor UI
- [ ] Schedule run history log
- [ ] Email/Slack notification channel options (not just Discord)

## 6. Cron Jobs (DONE)

- [x] Morning digest (7 AM weekdays) → #granger-digest
- [x] Overdue alerts (every 2h) → #granger-alerts
- [x] Granola polling (every 15 min)
- [x] Nightly synthesis (2 AM, Opus 4.6)
- [x] Linear status check (every 3 min)
- [x] Test crons & approvals (from notebook) — Run Now buttons work
- [ ] Pre-meeting prep cron (via Google Calendar)

## 7. Desktop Notifications (DONE)

- [x] Browser notification permission request
- [x] Poll /api/notifications/poll every 30s
- [x] Notifications for: schedule completions, pending approvals, new inbox items
- [x] Sonner toast fallback when desktop denied
- [x] Click notification → navigate to relevant page
- [x] Notification settings toggle
- [x] Session-level dedup (seenIds)
- [ ] Notification sound options
- [ ] Quiet hours setting
- [ ] Per-type notification preferences (only approvals, only urgent, etc.)

## 8. Context Library (DONE)

- [x] Google Drive-style card UI with grid/list toggle
- [x] Source type filter pills (All, Drive, Linear, etc.)
- [x] Drag-and-drop upload zone
- [x] Search + sort + content type filter
- [x] Download as .md per item
- [x] Delete with confirmation dialog
- [x] Demo mode inline processing (bypass Inngest)
- [x] 126 items visible from production
- [ ] File Preview / TipTap Editor (from notebook)
- [ ] Edit shared company files with approval of majority (from notebook)
- [ ] Folders / categories for organizing context
- [ ] Bulk download / bulk delete
- [ ] Versioning on docs (from notebook)
- [ ] File type icons (PDF, DOCX, etc. vs generic)

## 9. Chat Interface (DONE)

- [x] AI Elements rendering (Message, MessageContent, MessageResponse/Streamdown)
- [x] Tool call cards (ToolCallCard with ToolHeader/ToolContent)
- [x] Copy Debug JSON button
- [x] Model selector (9 models, 3 tiers)
- [x] Prompt pills for quick actions
- [x] Agent template pills (General, Sales Call, Sprint Retro, etc.)
- [x] Source citation sidebar
- [x] Feedback buttons (thumbs up/down)
- [x] Test chat (from notebook)
- [ ] Tag others to share chat (from notebook)
- [ ] Sandbox to write code tool (from notebook)
- [ ] Chat export (share conversation as link or PDF)
- [ ] Pin important messages
- [ ] Chat search (search across all conversations)

## 10. UI & Branding (DONE)

- [x] Rebranded to "Granger" throughout (sidebar, metadata, chat)
- [x] Simplified sidebar (MAIN/CONNECT/SETTINGS/MORE)
- [x] Testing checklist modal (34 items, localStorage)
- [x] Hydration error fix
- [ ] Dark mode polish (some components may not style correctly)
- [ ] Mobile responsive improvements
- [ ] Landing page update (still says "Layers" in places)
- [ ] Custom Granger icon/logo

## 11. Documentation (DONE)

- [x] GRANGER-SPEC.md (full development spec)
- [x] docs/guides/setup.md (step-by-step setup guide)
- [x] docs/guides/architecture.md (ASCII diagrams)
- [x] docs/plans/nango-removal-checklist.md
- [x] docs/plans/chat-sdk-migration.md
- [x] docs/dev-status.md (sprint tracking)
- [x] Priority documents (docs/priority/01-05)
- [ ] API reference doc (all endpoints)
- [ ] User guide (for Kyle and Bobby)

## 12. From Notebook — Not Yet Started

- [ ] **Permission system** — allow certain tools (edit in settings), initial set of circumstances & interview like Brand Studio
- [ ] **Think GitHub — org & org setup** — alignment + invites (support multiple orgs)
- [ ] **Have demos ready** — prepare demo scenarios for partners/investors
- [ ] **Get together with Lauren/Alex** — schedule and prep
- [ ] **Scaffolding with links & defaults** — pre-configured templates for new orgs
- [ ] **How does this scale?** — performance testing, multi-tenant load, cost projections

## 13. Production Deployment

- [ ] Set all env vars on Vercel (Discord, Google, Granola, Cron Secret)
- [ ] Apply all Supabase migrations to production
- [ ] Register Discord commands
- [ ] Create Discord channels (#granger-digest, #granger-alerts)
- [ ] Set Discord interactions URL
- [ ] Verify crons firing in Vercel dashboard
- [ ] Onboard Kyle — link Discord ID + API keys
- [ ] Onboard Bobby — link Discord ID + API keys
- [ ] Remove Nango code (follow checklist)

## 14. Nango Removal (Planned)

- [ ] Migrate GitHub sync handler to direct API
- [ ] Migrate Slack sync handler to direct API
- [ ] Remove @nangohq/node and @nangohq/frontend packages
- [ ] Remove src/lib/nango/ directory
- [ ] Remove Nango webhook handler
- [ ] Remove NANGO_SECRET_KEY from env
- [ ] Update integrations page to use direct API settings
- [ ] Follow docs/plans/nango-removal-checklist.md

---

## Session Stats (2026-03-30)

| Metric | Value |
|--------|-------|
| Commits | 24 |
| Lines added | ~14,000+ |
| Files created/modified | ~100 |
| New tables | 2 (scheduled_actions, + 4 from Sprint 1) |
| New API routes | 12+ |
| New components | 8+ |
| Sub-agents | 5 |
| Slash commands | 10 |
| Cron jobs | 5 |
| Default schedules | 5 |
