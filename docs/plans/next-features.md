# Granger — Next Features & Session Context

> Session: 2026-03-30 → 2026-03-31 (~14 hours, 61 commits, ~30,000+ lines)
> Builder: Alfonso with Claude Code (Opus 4.6, 1M context)

---

## Current State of Granger

### What Was Built This Session

Granger evolved from the Layers 2026.1 knowledge platform into a full AI chief of staff. Every feature below was built from scratch in one session:

**Core Agent**: Priority document system (5 docs always in system prompt), 5 specialist sub-agents (Linear, Gmail, Notion, Granola, Drive), conversation history compaction (Claude Code-style), 9-model matrix (3 providers × 3 tiers), 20-step ToolLoopAgent for multi-tool chaining.

**Chat Interface**: 12 slash commands with autocomplete dropdown, AI Elements rendering (Streamdown), artifact panel with file tree (mini IDE), stop button, copy messages, chat branching, export (Markdown/JSON), share with team.

**Tools (20+)**: search_context, get_document, list_linear_issues, create_linear_issue, query_granola, search_gmail, draft_email, search_notion, list_drive_files, propose_action, list_approvals, schedule_action, list_schedules, edit_schedule, delete_schedule, write_code, run_code, run_project, web_search, activate_skill.

**Approvals**: Inline approve/reject in chat with execution (calls Linear/Gmail APIs), clickable result URLs, follow-up messages to Granger after execution.

**Scheduling**: 6 cron jobs, scheduled_actions table, schedule executor (every-minute cron), Run Now buttons, timezone-aware display, desktop notifications.

**Context Library**: 133+ items, Google Drive-style grid/list view, source filters, drag-drop upload, TipTap rich text editor, document versioning with restore, majority-approval editing (2/3 vote).

**Code Execution**: write_code (display + local iframe preview), run_code (single file in Vercel Sandbox VM), run_project (multi-file with filesystem + npm install), artifact panel with file tree + Code/Preview/Live tabs.

**Skills**: 6 built-in skills, 23 marketplace skills from skills.sh, multi-step wizard creator, activate_skill tool, dynamic slash commands.

**MCP**: Connection manager at /mcp, add servers via URL + API key/OAuth, auto-discover tools, merge into agent's tool set.

**Web Search**: Perplexity via AI Gateway, citation extraction from provider metadata, clickable source chips.

**Discord**: Chat SDK bot (chat@4.23.0), slash commands, DMs, approval reactions, thread responses.

**Notifications**: Desktop native + sonner toasts, polls every 30s for schedule completions, approvals, inbox items, system chats.

**Other**: Permission system (per-service read/write), chat sharing + export, org scaffolding templates (3 types), collapsible sidebar/panels, full "Layers" → "Granger" rebrand across 20+ files, dark mode fixes, DEMO_MODE credit bypass, real-time date injection.

### Database Tables (12)

priority_documents, credentials, approval_queue, partner_settings, scheduled_actions, document_versions, edit_proposals, shared_conversations, skills, mcp_servers (+ existing: organizations, org_members, integrations, context_items, sessions, session_context_links, inbox_items, chat_messages, conversations, agent_runs, audit_log)

### Key Files

| What | Where |
|------|-------|
| Agent instructions + chat route | `src/app/api/chat/route.ts` |
| All tools (20+) | `src/lib/ai/tools.ts` |
| Sub-agents (5) | `src/lib/ai/agents/*.ts` |
| Chat interface + artifact panel | `src/components/chat-interface.tsx` |
| Sandbox execution | `src/lib/sandbox/execute.ts` |
| API clients (6) | `src/lib/api/*.ts` |
| Skills registry | `src/lib/skills/registry.ts` |
| MCP connection | `src/lib/mcp/connect.ts` |
| File tree component | `src/components/file-tree.tsx` |
| Priority docs loader | `src/lib/ai/priority-docs.ts` |
| Model config | `src/lib/ai/config.ts` |
| Schedule executor | `src/lib/schedule-executor.ts` |
| Granger spec | `docs/GRANGER-SPEC.md` |

### Tracking & Documentation

| Doc | What |
|-----|------|
| `docs/GRANGER-SPEC.md` | Full development specification (13 sections) |
| `docs/plans/granger-todo.md` | 100+ item TODO list with completion status |
| `docs/plans/next-session-priorities.md` | 6 architectural improvements |
| `docs/plans/next-features.md` | This file |
| `docs/plans/nango-removal-checklist.md` | Nango migration steps |
| `docs/guides/setup.md` | Full setup guide with env vars |
| `docs/guides/architecture.md` | ASCII diagrams for system overview |
| `docs/dev-status.md` | Sprint tracking (Sprints 1-5 complete) |
| `docs/priority/01-05*.md` | Priority documents (mission, team, priorities, clients, agent) |

---

## Next Features — Priority Build List

### 1. Persistent Sandboxes (Snapshots)

**What**: Save sandbox VM state so the next run starts instantly (no npm install).

**SDK API**:
```typescript
// After first run — save state
const snapshotId = await sandbox.snapshot();

// Next run — instant restore (all files + node_modules preserved)
const sandbox = await Sandbox.create({ snapshot: snapshotId });
```

**Tracking after stop**:
```typescript
await sandbox.stop({ blocking: true });
console.log(sandbox.activeCpuUsageMs);     // CPU time in ms
console.log(sandbox.networkUsage.ingress);  // bytes in
console.log(sandbox.networkUsage.egress);   // bytes out
```

**DB change**: `sandbox_snapshots` table or snapshotId on context_item.

**Estimated effort**: ~1 hour

---

### 2. Tool Creation Skill (Interview UI)

**What**: Interactive skill that guides users through creating a new tool via conversation.

**How**: AI SDK client-side tools (no execute = pauses for user input):
```typescript
const askQuestion = tool({
  description: 'Ask the user a question',
  inputSchema: z.object({ question: z.string(), options: z.array(z.string()).optional() }),
  // NO execute → renders UI, waits for addToolOutput()
});
```

**Flow**: /skill create → interview questions → generate tool code → test in sandbox → save as skill

**Estimated effort**: ~2 hours

---

### 3. File Uploads to Chat (Images, PDFs, Docs)

**What**: Drag-and-drop files into chat for Granger to analyze.

**How**: AI SDK v6 `FileUIPart`:
```typescript
sendMessage({
  text: "Analyze this document",
  files: [{ type: 'file', mediaType: 'application/pdf', url: dataUrl, filename: 'report.pdf' }],
});
```

**UI**: Paperclip button + drag-drop zone on chat input, file previews before sending.

**Estimated effort**: ~1 hour

---

### 4. Tool Creation via Sandbox

**What**: Create custom tools by writing and testing them in sandbox, then saving as skills.

**Flow**: User describes tool → Granger generates code → tests in sandbox → saves as skill → immediately available

**Estimated effort**: ~2 hours

---

### 5. Reference Files in Skills

**What**: Skills can have reference files that load into context when activated.

**DB change**: `reference_files` JSONB column on `skills` table.

**Estimated effort**: ~30 min

---

### 6. Sandbox Cost Tracking

**What**: Track and display sandbox compute costs per user.

**SDK provides (after sandbox.stop())**:
- `sandbox.activeCpuUsageMs` — CPU time in milliseconds
- `sandbox.networkUsage` — `{ ingress, egress }` in bytes
- `Sandbox.list({ since, until })` — enumerate sandboxes by time range

**No aggregate billing API** — must track per-sandbox and compute costs:
- ~$0.13/vCPU-hour
- ~$0.085/GB-hour memory
- $0.60/million sandbox creates

**Implementation**:
1. After each sandbox stops, log `activeCpuUsageMs` + `networkUsage` to a `sandbox_usage` table
2. Compute costs using known rates
3. Show on analytics page per user/per day
4. Set spend alerts via Vercel Spend Management

**Estimated effort**: ~1.5 hours

---

### 7. AI Gateway Observability & Cost Dashboard

**What**: Track AI costs per user, per model, per request across all Granger usage.

**AI Gateway provides**:

#### Per-Request Tracking
```typescript
// Attach user + tags to every AI call
const result = await generateText({
  model: gateway('anthropic/claude-sonnet-4.6'),
  prompt: userMessage,
  providerOptions: {
    gateway: {
      user: userId,           // tracks cost per partner
      tags: ['chat', 'linear-agent'],  // tracks cost per feature
    },
  },
});

// Get per-request cost
const generationId = result.providerMetadata?.gateway?.generationId;
const info = await gateway.getGenerationInfo({ id: generationId });
console.log(`Cost: $${info.totalCost}`);
```

#### Spend Reports API
```typescript
// Monthly cost by model
const report = await gateway.getSpendReport({
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  groupBy: 'model',
});

// Cost by user (partner)
const userReport = await gateway.getSpendReport({
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  groupBy: 'user',
});
```

**Custom Reporting API** (Pro/Enterprise):
```
GET https://ai-gateway.vercel.sh/v1/report
  ?start_date=2026-03-01
  &end_date=2026-03-31
  &group_by=model
  → Returns: model, total_cost, market_cost, input_tokens, output_tokens, request_count per row
```

**Filter by**: `user_id`, `model`, `tags`, `provider`, `credential_type`

**Credits API**:
```
GET https://ai-gateway.vercel.sh/v1/credits
  → { "balance": "95.50", "total_used": "4.50" }
```

#### Actionable Implementation Items

1. **Add `providerOptions.gateway.user` to chat route** — tag every request with the user's ID for per-partner cost tracking
2. **Add `providerOptions.gateway.tags` to chat route** — tag by tool name, skill name, agent type for cost attribution
3. **Capture `generationId` from responses** — store in `agent_runs` table for per-request cost lookup
4. **Build `/analytics/costs` page** — query spend reports by model, user, date range
5. **Show credit balance** in sidebar footer — `gateway.getCredits()`
6. **Cost alerts** — notify when daily spend exceeds threshold

**Estimated effort**: ~3 hours for full dashboard

---

### 8. MCP OAuth Flow (Deployed)

**What**: MCP servers like Granola need OAuth browser flow. Currently blocked because OAuth callbacks need a public URL (not localhost).

**Fix**: Deploy to Vercel → set callback URL → OAuth flow works end-to-end.

**Estimated effort**: ~30 min (after Vercel deploy)

---

### 9. Production Deployment Checklist

- [ ] Deploy to Vercel (`vercel deploy --prod`)
- [ ] Set all env vars in Vercel dashboard
- [ ] Update Google OAuth redirect URI to production URL
- [ ] Update MCP OAuth callback URL
- [ ] Register Discord commands with production interactions URL
- [ ] Create Discord channels (#granger-digest, #granger-alerts)
- [ ] Verify crons firing (7 cron jobs)
- [ ] Apply all Supabase migrations
- [ ] Onboard Kyle + Bobby (link Discord IDs, add API keys)
- [ ] Remove Nango code (follow checklist)

---

## Session Stats

| Metric | Value |
|--------|-------|
| Commits | 61 |
| Lines added | ~30,000+ |
| Files created/modified | ~220+ |
| Duration | ~14 hours |
| Features built | 40+ |
| DB tables | 12 new |
| API routes | 30+ |
| Components | 25+ |
| Tools | 20+ |
| Slash commands | 12 |
| Skills | 6 built-in + 23 marketplace |
| Cron jobs | 6 |
| Sub-agents | 5 |
| Agents spawned | 50+ |
