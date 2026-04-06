# Notification Event Catalog

> Canonical reference for every event that triggers (or should trigger) a notification in Layers.

---

## Event Table

| Event | Type | Trigger | Who Gets Notified | Link | Status |
|-------|------|---------|-------------------|------|--------|
| Schedule completed | `schedule_complete` | Cron executor finishes a scheduled action | Schedule owner | `/chat?id={convId}` | **Implemented** |
| Shared with you | `share` | Someone shares content with a user | Recipient | `/context/{id}` or `/s/{token}` | Not implemented |
| Chat mention | `chat_mention` | `@user` in multi-user chat | Mentioned user | `/chat?id={convId}` | Not implemented (no multi-user yet) |
| Approval needed | `approval_needed` | `propose_action` tool creates an approval record | Org admins | `/approvals` | Partially (approval row exists, no notification sent) |
| Library update | `library_update` | New content ingested via sync/upload | Org members | `/context/{id}` | Not implemented |
| Artifact shared | `share` | Artifact share link created | N/A (creator action) | `/s/{token}` | Not implemented |
| Skill created | `library_update` | New skill saved | Org members | `/skills` | Not implemented |
| Connector sync error | `system_alert` | Sync fails 3+ times consecutively | Org admins | `/settings/integrations` | Not implemented |
| Credit low | `system_alert` | Credits drop below threshold | Org owner | `/settings/billing` | Not implemented |

> The `validTypes` array in `/api/notifications` POST currently accepts: `chat_mention`, `share`, `schedule_complete`, `approval_needed`, `library_update`. Add `system_alert` when implementing connector/credit events.

---

## Event Details

### 1. Schedule completed

- **When it fires**: `execute-schedules` cron finishes running a `scheduled_action`. After the AI response is persisted and the schedule row is updated with `last_run_at`.
- **Notification data**:
  - `title`: `"Scheduled: {schedule.name}"`
  - `body`: First 200 chars of the AI response text
  - `link`: `/chat?id={conversationId}`
  - `metadata`: `{ schedule_id, conversation_id }`
- **Creation code**: `src/app/api/cron/execute-schedules/route.ts` (line ~199)
- **Priority**: Done

### 2. Shared with you

- **When it fires**: When a user creates a share link targeted at a specific user, or when content is shared directly via the sharing modal.
- **Notification data**:
  - `title`: `"{sharer_name} shared '{item_title}' with you"`
  - `body`: Optional description or first line of content
  - `link`: `/context/{id}` (direct item) or `/s/{token}` (share link)
  - `metadata`: `{ shared_by, item_id, item_type, share_token }`
- **Creation code should live in**: The share API route (e.g., `/api/share` POST handler) after the share record is inserted.
- **Priority**: P1 -- sharing is a core collaboration feature

### 3. Chat mention

- **When it fires**: When a user types `@username` in a chat message in a multi-user conversation.
- **Notification data**:
  - `title`: `"{sender_name} mentioned you"`
  - `body`: The message text (truncated to 200 chars)
  - `link`: `/chat?id={convId}`
  - `metadata`: `{ conversation_id, sender_id, message_id }`
- **Creation code should live in**: The message persistence layer, after a user message is saved. Parse `@mentions` from the text and resolve to user IDs.
- **Priority**: P2 -- requires multi-user chat infrastructure first

### 4. Approval needed

- **When it fires**: When the `propose_action` tool creates an approval record that requires human review.
- **Notification data**:
  - `title`: `"Approval needed: {action_summary}"`
  - `body`: Description of what the AI wants to do
  - `link`: `/approvals`
  - `metadata`: `{ approval_id, conversation_id, action_type }`
- **Creation code should live in**: `/api/approval` POST handler, after the approval row is inserted. Query `org_members` for users with admin role.
- **Priority**: P0 -- approvals exist but nobody knows they need to act on them

### 5. Library update

- **When it fires**: When new content is ingested -- either via connector sync (Nango webhook) or manual upload.
- **Notification data**:
  - `title`: `"New in library: {item_title}"`
  - `body`: `"From {source_type} -- {description_short}"`
  - `link`: `/context/{id}`
  - `metadata`: `{ item_id, source_type, source_id }`
- **Creation code should live in**: The ingestion pipeline -- specifically the webhook handlers (`/api/webhooks/google-drive`, `/api/webhooks/linear`, etc.) and the upload handler. Notify all org members (or use notification preferences to filter).
- **Priority**: P2 -- nice to have, but could be noisy; needs per-user preferences first

### 6. Artifact shared

- **When it fires**: When a user creates a public share link for an artifact.
- **Notification data**:
  - `title`: N/A (this is a creator action, not a recipient notification)
  - For future: if sharing with a specific user, same pattern as "Shared with you"
- **Creation code should live in**: Share link creation handler
- **Priority**: P2 -- depends on targeted sharing

### 7. Skill created

- **When it fires**: When a new skill is saved via the skills editor.
- **Notification data**:
  - `title`: `"New skill: {skill_name}"`
  - `body`: `"Created by {creator_name}"`
  - `link`: `/skills`
  - `metadata`: `{ skill_id, created_by }`
- **Creation code should live in**: `/api/skills` POST handler, after successful insert.
- **Priority**: P2 -- awareness feature, low urgency

### 8. Connector sync error

- **When it fires**: When a connector sync (Google Drive, GitHub, Slack, etc.) fails 3 or more consecutive times. Track failure count on the `integrations` or `nango_connections` row.
- **Notification data**:
  - `title`: `"Sync failing: {connector_name}"`
  - `body`: `"Failed {count} times. Last error: {error_message}"`
  - `link`: `/settings/integrations`
  - `metadata`: `{ integration_id, provider, error_count, last_error }`
- **Creation code should live in**: The sync error handler in `/api/webhooks/{provider}` routes, or in a dedicated health-check cron.
- **Priority**: P1 -- data freshness is critical; admins need to know when syncs break

### 9. Credit low

- **When it fires**: When org credit usage reaches a configurable threshold (e.g., 80% or 90% of monthly allocation). Check during the cost-tracking middleware or in the `credit-reset` cron.
- **Notification data**:
  - `title`: `"Credits running low"`
  - `body`: `"{remaining} credits remaining ({percentage}% used)"`
  - `link`: `/settings/billing`
  - `metadata`: `{ org_id, remaining, total, percentage }`
- **Creation code should live in**: The cost-tracking logic or a dedicated cron that checks thresholds. Only notify once per threshold crossing (use metadata to deduplicate).
- **Priority**: P1 -- directly impacts ability to use the product

---

## Delivery Channels

### In-app bell (Implemented)

- **Component**: `src/components/notification-bell.tsx`
- **How it works**: Polls `/api/notifications` every 30 seconds. Shows unread count badge. Popover lists recent notifications with type icons, relative timestamps, and click-to-navigate.
- **DB table**: `notifications` (columns: `id`, `org_id`, `user_id`, `type`, `title`, `body`, `link`, `metadata`, `is_read`, `created_at`)

### Desktop browser notifications (Implemented)

- **Module**: `src/lib/notifications/desktop.ts`
- **How it works**: Requests `Notification` API permission on mount. When new unread notifications appear during polling (not on first load), fires a browser `Notification` with title, body, and click-to-navigate.
- **Limitation**: Only works when the tab is open (polling-based). No service worker push.

### Email (Not implemented)

- **Needed**: SendGrid or Resend integration
- **Approach**: Add an `email` column or preference to user settings. On notification insert, check if user has email delivery enabled. Queue an email via SendGrid/Resend API. Use existing digest template infrastructure (`src/lib/email/digest-template.ts`) as a starting point.
- **Batching**: Consider batching non-urgent notifications into a 5-minute digest to avoid spamming. Urgent types (`approval_needed`, `system_alert`) should send immediately.

### iOS push (Not implemented)

- **Needed**: APNs via Capacitor or FCM
- **Infrastructure exists**: `src/lib/notifications/send-push.ts` has the skeleton. `src/lib/notifications/push-registration.ts` handles device token registration. `device_tokens` table exists.
- **Approach**: Implement the actual APNs/FCM send in `sendPushNotification()`. On notification insert, call `sendPushNotification()` for the target user. The payload maps directly: `title` -> push title, `body` -> push body, `link` -> deep link.

### Slack webhook (Not implemented)

- **Needed**: Slack Incoming Webhook URL per org or per user
- **Approach**: Store webhook URL in org settings. On notification insert (for types the org opts into), POST to the Slack webhook with a formatted message block. Good for `system_alert` and `approval_needed` types that need team visibility.

---

## Implementation Notes

### Creating notifications server-side

All notification creation follows the same pattern (see `execute-schedules` for the reference implementation):

```typescript
await supabase.from("notifications").insert({
  org_id: orgId,
  user_id: targetUserId,
  type: "schedule_complete", // one of the valid types
  title: "Notification title",
  body: "Optional body text",
  link: "/path/to/relevant/page",
  metadata: { /* arbitrary JSON */ },
});
```

### Adding new notification types

1. Add the type string to the `validTypes` array in `src/app/api/notifications/route.ts`
2. Add an icon mapping in `TYPE_ICONS` in `src/components/notification-bell.tsx`
3. Insert the notification in the relevant server-side handler

### Deduplication

For recurring events (credit low, sync errors), use `metadata` to track whether a notification was already sent for the current period. Example: store `{ last_notified_at, threshold }` and skip if already notified within the current billing cycle.

### Priority Summary

| Priority | Events | Rationale |
|----------|--------|-----------|
| P0 | Approval needed | Blocking -- approvals exist but nobody sees them |
| P1 | Shared with you, Connector sync error, Credit low | Core UX and reliability |
| P2 | Library update, Chat mention, Skill created, Artifact shared | Nice-to-have, some need prerequisites |
