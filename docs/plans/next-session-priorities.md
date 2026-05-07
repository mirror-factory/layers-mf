# Next Session Priorities

> From testing session 2026-03-31 ~2AM. These are architectural improvements identified during live testing.

## 1. MCP OAuth Support (HIGH)

**Problem**: MCP servers like Granola (`https://mcp.granola.ai/mcp`) require OAuth browser flow, not just API keys. Current MCP manager only supports Bearer token auth.

**Fix**:
- Add "Connect with OAuth" button to MCP server form
- When clicked, redirect to the MCP server's OAuth endpoint
- On callback, store the OAuth access token + refresh token in `mcp_servers.api_key_encrypted`
- Use `authProvider` parameter in `createMCPClient` transport config
- The AI SDK supports this: `transport: { type: 'http', url, authProvider }`
- Need OAuth callback route: `/api/mcp/oauth/callback`

**Reference**: AI SDK MCP docs at `docs/ai-sdk/03-ai-sdk-core/16-mcp-tools.mdx` line 39-46

## 2. Scheduled Tasks → Chat Conversations (HIGH)

**Problem**: Scheduled tasks (crons) run as background API calls and the user never sees the results unless they check the specific page. They should create real chat conversations.

**Fix**:
- When a scheduled task runs, create a `conversation` in the database
- Store the task result as a chat message (role: 'assistant', channel: 'system')
- Show these system-initiated conversations in the chat list with a distinct icon (⏰ or 🤖)
- The user can then respond to continue the conversation
- Flow: Schedule fires → runs the action → creates conversation → stores result → notification

**Schema change**: Add `initiated_by` column to `conversations`: 'user' | 'system' | 'schedule'

## 3. Real-Time Timezone Handling (MEDIUM)

**Problem**: Scheduling uses server time (UTC on Vercel) but users think in local time. "Every morning at 7am" should mean 7am in the user's timezone.

**Fix**:
- Add `timezone` field to `partner_settings` (e.g., 'America/New_York')
- Auto-detect from browser on first visit: `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Cron schedule display should show local time, not UTC
- Schedule executor should convert cron expressions to UTC before running
- The `croner` package already supports timezone-aware cron

## 4. Browser Notifications for All AI Activity (MEDIUM)

**Problem**: Notifications only fire for schedule completions, approvals, and inbox items. All AI-initiated chat messages should also trigger notifications.

**Fix**:
- When a system-initiated conversation is created (from #2 above), add it to the notification poll response
- New notification type: 'system_message' with preview text
- Click → opens the specific conversation in chat
- The notification provider already polls every 30 seconds — just expand what it checks

## 5. Notification → Specific Chat (MEDIUM)

**Problem**: Notifications currently link to generic pages (/schedules, /approvals). They should link directly to the relevant chat conversation.

**Fix**:
- When creating system conversations (#2), store the conversation ID
- Notification click navigates to `/chat?id=<conversation_id>`
- The chat page already supports `?id=` parameter for opening specific conversations

## 6. MCP Server Health Monitoring (LOW)

**Problem**: Once added, MCP servers have no health checks. They could go down silently.

**Fix**:
- Add a cron that pings each active MCP server every hour
- Update `last_connected_at` and `error_message` fields
- Show health status on the MCP page (green/red indicator)
- Notification if a server goes down

---

## Session Stats (2026-03-30 → 2026-03-31)

| Metric | Value |
|--------|-------|
| Commits | 41 |
| Lines added | ~25,000+ |
| Files created/modified | ~200+ |
| Duration | ~12 hours |
| Features built | 35+ |
| DB tables created | 10 |
| API routes created | 25+ |
| Components created | 20+ |
