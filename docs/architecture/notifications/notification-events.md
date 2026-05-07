# Notification Event Catalog

> Canonical reference for every event that triggers (or should trigger) a notification in Layers.

---

## Event Table

| Event | Type | Trigger | Who Gets Notified | Link | Status |
|-------|------|---------|-------------------|------|--------|
| Schedule completed | `schedule_complete` | Cron executor finishes a scheduled action | Schedule owner | `/chat?id={convId}` | **WORKING** |
| Schedule failed | `system_alert` | Cron executor catches an error | Schedule owner | `/schedules` | **WORKING** |
| Shared with you | `share` | Someone shares content with a user | Recipient | `/context/{id}` or `/artifacts/{id}` | **WORKING** |
| Approval needed | `approval_needed` | `propose_action` tool creates an approval record | Org admins/owners | `/approvals` | **WORKING** |
| Integration sync error | `system_alert` | Sync stream catches a top-level error | Triggering user | `/settings/integrations` | **WORKING** |
| Credit low | `credit_low` | Balance drops below 100 after deduction | Org owner | `/settings/billing` | **WORKING** |
| Chat mention | `chat_mention` | `@user` in multi-user chat | Mentioned user | `/chat?id={convId}` | **NEEDS MULTI-USER CHAT** |
| Library update | `library_update` | New content ingested via sync/upload | Org members | `/context/{id}` | **FUTURE** |

> The `validTypes` array in `/api/notifications` POST accepts: `chat_mention`, `share`, `schedule_complete`, `approval_needed`, `library_update`, `system_alert`, `credit_low`.

---

## Implementation Status

| Event | In-App Bell | Desktop Browser | Push (iOS/Android) | Email | Status |
|-------|------------|----------------|-------------------|-------|--------|
| schedule_complete | Yes | Yes | Built (needs APNs creds) | Yes (via Resend, notifications@mirrorfactory.ai) | WORKING |
| schedule_failure (system_alert) | Yes | Yes | Built (needs APNs creds) | No | WORKING |
| share | Yes | Yes | Built (needs APNs creds) | If email_on_mention pref | WORKING |
| approval_needed | Yes | Yes | Built (needs APNs creds) | If email_on_action_item pref | WORKING |
| integration_error (system_alert) | Yes | Yes | Built (needs APNs creds) | No | WORKING |
| credit_low | Yes | Yes | Built (needs APNs creds) | Always (org owner) | WORKING |
| chat_mention | Not built | Not built | Not built | Not built | NEEDS MULTI-USER CHAT |
| library_update | Not built | Not built | Not built | Not built | FUTURE |

---

## Known Issues and Next Steps

- **iOS push**: Code built in `src/lib/notifications/apns.ts`. Needs APNs p8 key from Apple Developer portal (see ~/Desktop/PUSH-NOTIFICATION-SETUP.md). Capacitor plugin bridge handles native side.
- **Android push**: Code built. Needs Firebase project + google-services.json. Currently logs and skips Android tokens in `send-push.ts`.
- **Email**: Working via Resend SDK. Sending from `notifications@mirrorfactory.ai`. Requires `RESEND_API_KEY` env var; silently disabled when missing.
- **Desktop**: Working via Browser Notification API (`src/lib/notifications/desktop.ts`). User must grant permission in Chrome/Safari. Only fires when the tab is open (polling-based, no service worker push).
- **Sound**: Working via Web Audio API (toggleable in /settings/notifications).
- **Email preferences**: Enforced in `notify()`. Maps notification types to preference fields: `email_on_mention`, `email_on_action_item`, `email_on_new_context`, `digest_enabled`.
- **Push preferences**: Not yet enforced. All registered devices receive push for every notification. Needs per-type filtering.
- **Daily digest**: Settings exist (`digest_enabled` in `notification_preferences`) but the digest cron (`/api/cron/digest`) does not aggregate notifications into a digest email yet.
- **chat_mention and library_update**: Both require the multi-user chat feature to be built first.
- **Slack webhook**: Not implemented. Would need per-org webhook URL stored in org settings.

---

## Unified notify() Function

All notification triggers use the unified `notify()` function from `src/lib/notifications/notify.ts`. A single call handles three delivery channels:

1. **In-app** (always) -- inserts a row into the `notifications` table. The notification bell component polls for new rows every 30 seconds.
2. **Push** (if device registered) -- sends via APNs for iOS devices. Looks up `device_tokens` for the user and sends to all registered devices. Invalid tokens are automatically cleaned up. Android/web tokens are logged and skipped.
3. **Email** (if preferences allow) -- sends via Resend. Checks the `notification_preferences` table for the user and maps notification type to the relevant preference field:
   - `chat_mention` -> `email_on_mention`
   - `approval_needed` -> `email_on_action_item`
   - `library_update` -> `email_on_new_context`
   - `schedule_complete` -> `digest_enabled`
   - `credit_low` -> always sends (critical alert)
   - `system_alert` -> never sends email

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

Schedules are the primary automated notification source. Here is the full flow:

1. User creates a schedule at `/schedules` using the date/time picker (Once, Daily, Weekly, or custom interval).
2. Vercel cron (or external trigger) hits `GET /api/cron/execute-schedules` with `Authorization: Bearer {CRON_SECRET}`.
3. The executor queries `scheduled_actions` for rows where `status = 'active'` and `next_run_at <= now()`, limited to 10 per run.
4. For each due schedule, the executor:
   - Creates a new conversation (`conversations` table, `initiated_by: "schedule"`).
   - Saves the user message from the schedule's prompt.
   - Runs `generateText()` with `google/gemini-3-flash` via AI Gateway, using `search_context` tool (no sandbox, no integrations).
   - Saves the AI response as an assistant message.
   - Updates `last_run_at`, `run_count`, `last_conversation_id`, and calculates `next_run_at` on the schedule.
   - For one-shot schedules (`once:` prefix) or schedules that hit `max_runs`, sets status to `completed`.
5. After execution, calls `notify()` which:
   - Inserts a notification in the `notifications` table (appears in the bell within 30 seconds via polling).
   - Sends push via APNs to all registered device tokens (if APNs credentials are configured).
   - Sends email via Resend if the user's `digest_enabled` preference is true.
   - Desktop notification fires from the bell's polling cycle (if the browser tab is open and notifications are permitted).
   - Ping sound plays if the user has sound enabled in /settings/notifications.
6. On failure, the executor catches the error, writes `error_message` to the schedule row, and calls `notify()` with type `system_alert` -- no email is sent for system alerts.
7. The conversation is linked via `/chat?id={conversationId}` in the notification's `link` field.

Users can also trigger a schedule on-demand via `POST /api/schedules/execute` ("Run Now" button), which follows the same execution and notification flow but uses the authenticated user's context instead of the cron secret.

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

### 2. Schedule failed

- **When it fires**: `execute-schedules` cron catches an error during AI execution or conversation creation.
- **Notification data**:
  - `type`: `system_alert`
  - `title`: `"Schedule failed: {schedule.name}"`
  - `body`: `"Error: {error_message}"` (truncated to 200 chars)
  - `link`: `/schedules`
  - `metadata`: `{ schedule_id, error }`
- **Creation code**: `src/app/api/cron/execute-schedules/route.ts` -- catch block uses `notify()`

### 3. Shared with you

- **When it fires**: When a user shares content directly with another user via the content_shares system in `/api/sharing` POST.
- **Notification data**:
  - `title`: `"{sharer_name} shared "{item_title}" with you"`
  - `body`: `"You have {permission} access."`
  - `link`: `/context/{id}` or `/artifacts/{id}` depending on content type
  - `metadata`: `{ content_type, content_id, shared_by }`
- **Creation code**: `src/app/api/sharing/route.ts` POST handler -- fire-and-forget after share insert

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
  - `type`: `system_alert`
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

### 7. Chat mention

- **Status**: Not built -- requires multi-user chat infrastructure first
- **Planned notification data**:
  - `title`: `"{sender_name} mentioned you"`
  - `body`: The message text (truncated to 200 chars)
  - `link`: `/chat?id={convId}`
  - `metadata`: `{ conversation_id, sender_id, message_id }`

### 8. Library update

- **Status**: Not built -- needs per-user notification preferences to avoid noise

---

## Delivery Channels

### In-app bell (Working)

- **Component**: `src/components/notification-bell.tsx`
- **How it works**: Polls `/api/notifications` every 30 seconds. Shows unread count badge. Popover lists recent notifications with type icons, relative timestamps, and click-to-navigate.
- **DB table**: `notifications` (columns: `id`, `org_id`, `user_id`, `type`, `title`, `body`, `link`, `metadata`, `is_read`, `created_at`)
- **Icon mapping**: `TYPE_ICONS` in notification-bell.tsx maps types to Lucide icons (includes `system_alert` -> AlertTriangle, `credit_low` -> CreditCard)

### Desktop browser notifications (Working)

- **Module**: `src/lib/notifications/desktop.ts`
- **How it works**: Requests `Notification` API permission on mount. When new unread notifications appear during polling (not on first load), fires a browser `Notification` with title, body, and click-to-navigate.
- **Limitation**: Only works when the tab is open (polling-based). No service worker push.

### Push notifications -- iOS (Built, needs credentials)

- **Module**: `src/lib/notifications/send-push.ts` -> `src/lib/notifications/apns.ts`
- **How it works**: Looks up device tokens from `device_tokens` table. Sends via APNs for iOS devices. Automatically removes invalid/expired tokens.
- **Registration**: `src/lib/notifications/push-registration.ts` handles device token registration via Capacitor plugin bridge.
- **Status**: Code is complete. Needs APNs p8 key from Apple Developer portal to function in production.

### Push notifications -- Android (Built, needs credentials)

- **Module**: `src/lib/notifications/send-push.ts`
- **How it works**: Android tokens are detected but currently logged and skipped ("not implemented" log message).
- **Status**: Capacitor Android project exists. Needs Firebase project + google-services.json to enable FCM delivery.

### Email via Resend (Working)

- **Module**: `src/lib/notifications/send-email.ts`
- **How it works**: Uses Resend SDK to send transactional emails from `Granger <notifications@mirrorfactory.ai>`.
- **Preference-aware**: The `notify()` function checks `notification_preferences` before sending. Different notification types map to different preference fields.
- **Env var**: `RESEND_API_KEY` -- if not set, email is silently disabled.

### Slack webhook (Not implemented)

- **Needed**: Slack Incoming Webhook URL per org or per user
- **Approach**: Store webhook URL in org settings. On notification insert (for types the org opts into), POST to the Slack webhook with a formatted message block. Good for `system_alert` and `approval_needed` types that need team visibility.

---

## Native App Status (Capacitor)

### iOS

- Push notifications: Built. Requires APNs credentials (see ~/Desktop/PUSH-NOTIFICATION-SETUP.md)
- Dynamic Island: Widget exists (GrangerLiveActivity), not yet connected to server pushes
- Background execution: Limited to push handling (no background JS execution)
- Status: Push pipeline built, credentials pending

### Android

- Push notifications: Built. Requires Firebase project + google-services.json
- Background execution: Same as iOS -- push delivery only
- Status: Capacitor Android project created, Firebase setup pending

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

Note: The on-demand execute route (`/api/schedules/execute`) still inserts directly into `notifications` instead of using `notify()`. This means on-demand runs do not send push or email -- only in-app. This is a known gap.

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
| Done | schedule_complete, schedule_failure, share, approval_needed, integration_error, credit_low | Core notification triggers wired up |
| Blocked | chat_mention | Needs multi-user chat infrastructure |
| Future | library_update | Needs per-user preferences to avoid noise |
