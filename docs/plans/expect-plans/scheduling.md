# Expect Plan — Scheduling

> Run: `EXPECT_BASE_URL=http://localhost:3000 npx expect-cli --agent claude -m "$(cat docs/plans/expect-plans/scheduling.md)" -y`

## Matrix
- Desktop 1440×900, Mobile 393×852
- Light + Dark
- Single logged-in user in a solo org with timezone set to America/Los_Angeles

## Setup
1. Log in as test user.
2. Navigate to `/settings/api-keys` — confirm timezone field shows "America/Los_Angeles".
3. Navigate to `/schedules`.

## Scenario 1 — Create schedule via UI
1. Click "New Schedule".
2. Name: "Daily 8am check-in".
3. Cron: `0 8 * * *`.
4. Tool tier: `standard`.
5. Save.
6. **Expect**: schedule appears in list with "Daily at 8:00 AM PST" (NOT UTC).

## Scenario 2 — Run Now creates conversation
1. Click "Run Now" on the schedule.
2. **Expect**: toast "Running schedule…"
3. **Expect**: within 10s, toast "Schedule complete — view chat"
4. Navigate to `/chat`.
5. **Expect**: new conversation with ⏰ icon and title starting with "Schedule:"
6. Open it.
7. **Expect**: assistant message with the schedule result.
8. **Expect**: reply input is active — user can continue the conversation.

## Scenario 3 — Browser notification
1. Before Run Now, grant notification permission.
2. Click Run Now.
3. **Expect**: system notification fires with title "Schedule complete" and the schedule name.
4. Click the notification.
5. **Expect**: lands directly on `/chat?id=<conversation_id>` showing the result.

## Scenario 4 — Create schedule via chat
1. Open `/chat`.
2. Send: "Schedule a summary of my Linear issues every Friday at 5pm."
3. **Expect**: tool call `schedule_action` renders.
4. **Expect**: result says "Schedule created".
5. Navigate `/schedules` — new row present with "Friday 5:00 PM PST".

## Scenario 5 — Timezone edge cases
1. Change timezone to "Asia/Tokyo" in settings.
2. Reload `/schedules`.
3. **Expect**: all times reflect Tokyo time (e.g. "Saturday 9:00 AM JST" for a Friday 5pm PST cron).
4. **Expect**: underlying cron string unchanged.

## Scenario 6 — Edit schedule
1. Click edit on an existing schedule.
2. Change tool_tier from `standard` to `full`.
3. Save.
4. **Expect**: badge updates to "Full".

## Scenario 7 — Delete schedule
1. Delete a schedule.
2. Confirm.
3. **Expect**: row disappears, toast confirms.

## Scenario 8 — Mobile specifics
1. On 393×852:
2. `/schedules` list renders as single column.
3. "New Schedule" opens full-screen dialog (not side sheet).
4. Run Now button is tap-sized (min 44×44pt).

## Scenario 9 — Dark mode
1. Toggle dark.
2. `/schedules`: verify no white flash, contrast ≥ 4.5:1 on all text.
3. Schedule detail: clock icon visible, cron text legible.
4. Run Now button: hover state distinct from default.

## Scenario 10 — Cron validator
1. Create schedule with cron `* * *` (invalid).
2. **Expect**: inline error "Invalid cron — expected 5 fields".
3. Save button disabled until fixed.

## Failure logging
Any failure → log to `master-improvement-plan.md` eval log + open issue in `master-testing-checklist.md` run history.
