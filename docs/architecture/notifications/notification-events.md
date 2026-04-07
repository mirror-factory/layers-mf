# Notification Event Catalog

> Canonical reference for every event that triggers (or should trigger) a notification in Layers.

---

## Event Table

| Event | Type | Trigger | Who Gets Notified | Link | Status |
|-------|------|---------|-------------------|------|--------|
| Schedule completed | `schedule_complete` | Cron executor finishes a scheduled action | Schedule owner | `/chat?id={convId}` | **Implemented** |
| Schedule failed | `system_alert` | Cron executor catches an error | Schedule owner | `/schedules` | **Implemented** |
| Shared with you | `share` | Someone shares content with a user | Recipient | `/context/{id}` or `/artifacts/{id}` | **Implemented** |
| Approval needed | `approval_needed` | `propose_action` tool creates an approval record | Org admins/owners | `/approvals` | **Implemented** |
| Integration sync error | `system_alert` | Sync stream catches a top-level error | Triggering user | `/settings/integrations` | **Implemented** |
| Credit low | `credit_low` | Balance drops below 100 after deduction | Org owner | `/settings/billing` | **Implemented** |
| Chat mention | `chat_mention` | `@user` in multi-user chat | Mentioned user | `/chat?id={convId}` | Not built (needs multi-user chat) |
| Library update | `library_update` | New content ingested via sync/upload | Org members | `/context/{id}` | Not built |
| Artifact shared | `share` | Artifact share link created | N/A (creator action) | `/s/{token}` | Not built |
| Skill created | `library_update` | New skill saved | Org members | `/skills` | Not built |

> The `validTypes` array in `/api/notifications` POST accepts: `chat_mention`, `share`, `schedule_complete`, `approval_needed`, `library_update`, `system_alert`, `credit_low`.

---

## Implementation Status

| Event | In-App | Push | Email | Status |
|-------|--------|------|-------|--------|
| schedule_complete | Yes | Yes | Via digest | Implemented |
| share | Yes | Yes | If email_on_mention | Implemented |
| approval_needed | Yes | Yes | If email_on_action_item | Implemented |
| system_alert (sync/schedule error) | Yes | Yes | No | Implemented |
| credit_low | Yes | Yes | Yes (always for owner) | Implemented |
| chat_mention | No | No | No | Not built (needs multi-user chat) |
| library_update | No | No | No | Not built |

---

## Unified notify() Function

All notification triggers use the unified `notify()` function from `src/lib/notifications/notify.ts`. A single call handles three delivery channels:

1. **In-app** (always) -- inserts a row into the `notifications` table. The notification bell component polls for new rows every 30 seconds.
2. **Push** (if device registered) -- sends via APNs for iOS devices. Looks up `device_tokens` for the user and sends to all registered devices. Invalid tokens are automatically cleaned up.
3. **Email** (if preferences allow) -- sends via Resend. Checks the `notification_preferences` table for the user and maps notification type to the relevant preference field:
   - `chat_mention` -> `email_on_mention`
   - `approval_needed` -> `email_on_action_item`
   - `library_update` -> `email_on_new_context`
   - `schedule_complete` -> `digest_enabled`
   - `credit_low` -> always sends (critical alert)

### Usage

```typescript
import { notify } from "@/lib/notifications/notify";

await notify({
  userId: "target-user-id",
  orgId: "org-id",
  type: "schedule_complete",
  title: "Notification title",
  body: "Notification body text",
  link: "/path/to/relevant/page",
  metadata: { key: "value" },
});
```

Push and email are fire-and-forget -- failures are caught silently to avoid blocking the main flow. The `RESEND_API_KEY` environment variable must be set for email delivery; if missing, emails are skipped with a log message.

---

## Scheduling + Notifications Integration

Schedules run on Vercel cron (server-side) via `/api/cron/execute-schedules`. When a schedule completes or fails:

1. **On success**: calls `notify()` with type `schedule_complete`, which:
   - Creates an in-app notification (bell icon, 30s polling)
   - Sends push via APNs/FCM (even if app is closed)
   - Sends email if user's `digest_enabled` preference is true
   - The scheduled conversation is linked via `link: /chat?id={conversationId}`

2. **On failure**: calls `notify()` with type `system_alert`, which:
   - Creates an in-app notification visible immediately
   - Sends push notification with the error summary
   - Does not send email (system_alert type is not mapped to an email preference)

---

## Event Details

### 1. Schedule completed

- **When it fires**: `execute-schedules` cron finishes running a `scheduled_action`. After the AI response is persisted and the schedule row is updated with `last_run_at`.
- **Notification data**:
  - `title`: `"Scheduled: {schedule.name}"`
  - `body`: First 200 chars of the AI response text
  - `link`: `/chat?id={conversationId}`
  - `metadata`: `{ schedule_id, conversation_id }`
- **Creation code**: `src/app/api/cron/execute-schedules/route.ts` -- uses `notify()`

### 2. Shared with you

- **When it fires**: When a user shares content directly with another user via the content_shares system in `/api/sharing` POST.
- **Notification data**:
  - `title`: `"{sharer_name} shared "{item_title}" with you"`
  - `body`: `"You have {permission} access."`
  - `link`: `/context/{id}` or `/artifacts/{id}` depending on content type
  - `metadata`: `{ content_type, content_id, shared_by }`
- **Creation code**: `src/app/api/sharing/route.ts` POST handler -- fire-and-forget after share insert

### 3. Chat mention

- **When it fires**: When a user types `@username` in a chat message in a multi-user conversation.
- **Notification data**:
  - `title`: `"{sender_name} mentioned you"`
  - `body`: The message text (truncated to 200 chars)
  - `link`: `/chat?id={convId}`
  - `metadata`: `{ conversation_id, sender_id, message_id }`
- **Status**: Not built -- requires multi-user chat infrastructure first

### 4. Approval needed

- **When it fires**: When the `propose_action` tool creates an approval record in the `approval_queue` table.
- **Notification data**:
  - `title`: `"Approval needed: {action_type}"`
  - `body`: `"AI wants to {action_type} on {target_service}. {reasoning}"`
  - `link`: `/approvals`
  - `metadata`: `{ approval_id }`
- **Creation code**: `src/lib/ai/tools.ts` `propose_action` execute function -- fire-and-forget, notifies all org admins/owners

### 5. Integration sync error

- **When it fires**: When the integration sync stream (`/api/integrations/sync`) catches a top-level error.
- **Notification data**:
  - `title`: `"Sync failed: {provider}"`
  - `body`: `"Error syncing {provider}: {error_message}"`
  - `link`: `/settings/integrations`
  - `metadata`: `{ provider, connection_id, error }`
- **Creation code**: `src/app/api/integrations/sync/route.ts` -- fire-and-forget in catch block

### 6. Credit low

- **When it fires**: When `deductCredits()` reduces the org balance below 100 credits (deduplicated to once per 24 hours).
- **Notification data**:
  - `title`: `"Credits running low"`
  - `body`: `"Your organization has {remaining} credits remaining. Top up to avoid service interruption."`
  - `link`: `/settings/billing`
  - `metadata`: `{ remaining }`
- **Creation code**: `src/lib/credits.ts` `deductCredits()` -- fire-and-forget, notifies org owner only

### 7. Library update

- **Status**: Not built -- needs per-user notification preferences to avoid noise

### 8. Skill created

- **Status**: Not built -- low priority awareness feature

---

## Delivery Channels

### In-app bell (Implemented)

- **Component**: `src/components/notification-bell.tsx`
- **How it works**: Polls `/api/notifications` every 30 seconds. Shows unread count badge. Popover lists recent notifications with type icons, relative timestamps, and click-to-navigate.
- **DB table**: `notifications` (columns: `id`, `org_id`, `user_id`, `type`, `title`, `body`, `link`, `metadata`, `is_read`, `created_at`)
- **Icon mapping**: `TYPE_ICONS` in notification-bell.tsx maps types to Lucide icons (includes `system_alert` -> AlertTriangle, `credit_low` -> CreditCard)

### Desktop browser notifications (Implemented)

- **Module**: `src/lib/notifications/desktop.ts`
- **How it works**: Requests `Notification` API permission on mount. When new unread notifications appear during polling (not on first load), fires a browser `Notification` with title, body, and click-to-navigate.
- **Limitation**: Only works when the tab is open (polling-based). No service worker push.

### Push notifications (Implemented)

- **Module**: `src/lib/notifications/send-push.ts`
- **How it works**: Looks up device tokens from `device_tokens` table. Sends via APNs for iOS devices. Automatically removes invalid/expired tokens.
- **Registration**: `src/lib/notifications/push-registration.ts` handles device token registration.
- **Limitation**: Android/web push not yet implemented (logged and skipped).

### Email via Resend (Implemented)

- **Module**: `src/lib/notifications/send-email.ts`
- **How it works**: Uses Resend SDK to send transactional emails from `notifications@layers.hustletogether.com`.
- **Preference-aware**: The `notify()` function checks `notification_preferences` before sending. Different notification types map to different preference fields.
- **Env var**: `RESEND_API_KEY` -- if not set, email is silently disabled.

### Slack webhook (Not implemented)

- **Needed**: Slack Incoming Webhook URL per org or per user
- **Approach**: Store webhook URL in org settings. On notification insert (for types the org opts into), POST to the Slack webhook with a formatted message block. Good for `system_alert` and `approval_needed` types that need team visibility.

---

## Native App Status (Capacitor)

### iOS

- Push notifications: Built. Requires APNs credentials (see PUSH-NOTIFICATION-SETUP.md)
- Dynamic Island: Widget exists (GrangerLiveActivity), not yet connected to server pushes
- Background execution: Limited to push handling (no background JS execution)
- Status: In progress -- push pipeline built, credentials pending

### Android

- Push notifications: Built. Requires Firebase project + google-services.json
- Background execution: Same as iOS -- push delivery only
- Status: In progress -- Capacitor Android project created, Firebase setup pending

### Desktop (macOS/Windows)

- Browser Notification API: Working (macOS banners)
- No native desktop app -- all notifications go through the browser
- Requires browser to be running for desktop notifications
- Sound: Web Audio API ping (works in all browsers)

Note: iOS and Android native apps are wrappers around the web app via Capacitor. Full native development is not the current focus. Push notifications work via the Capacitor plugin bridge, not native Swift/Kotlin code.

---

## Implementation Notes

### Creating notifications server-side

All notification creation should use the unified `notify()` function:

```typescript
import { notify } from "@/lib/notifications/notify";

await notify({
  userId: targetUserId,
  orgId,
  type: "schedule_complete",
  title: "Notification title",
  body: "Optional body text",
  link: "/path/to/relevant/page",
  metadata: { key: "value" },
});
```

This replaces the previous pattern of manually inserting into the `notifications` table and calling `sendPushNotification()` separately.

### Adding new notification types

1. Add the type string to the `validTypes` array in `src/app/api/notifications/route.ts`
2. Add an icon mapping in `TYPE_ICONS` in `src/components/notification-bell.tsx`
3. Map the type to an email preference field in `notify()` (src/lib/notifications/notify.ts)
4. Call `notify()` in the relevant server-side handler

### Deduplication

For recurring events (credit low, sync errors), use time-based deduplication. The credit_low notification checks for an existing notification within the last 24 hours before sending a new one. Apply a similar pattern for other recurring alerts.

### Priority Summary

| Priority | Events | Rationale |
|----------|--------|-----------|
| Done | Schedule complete, Share, Approval needed, Sync error, Credit low | Core notification triggers wired up |
| P2 | Library update, Chat mention, Skill created, Artifact shared | Nice-to-have, some need prerequisites |
