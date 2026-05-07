# Session 6 Backlog

> Issues identified during session 5 (April 7-8, 2026) that need dedicated attention.

## Portal Issues

### ~~Zoom not working~~ ✅ Fixed (April 8)
`pageWidth` was capped at 700px with `Math.min(available, 700)` — zoom had no effect past that cap. Fixed by computing `baseWidth` at zoom=1 then multiplying: `return baseWidth * zoom`.

### ~~Search/highlight goes to wrong position~~ ✅ Fixed (April 8)
Root cause: `scrollIntoView()` doesn't work reliably inside custom `overflow-auto` divs when react-pdf's CSS `transform: scaleX()` is applied on text layer spans. Fixed with `scrollElementIntoContainer()` — a manual scroll calculation using `getBoundingClientRect()` relative to the scroll container.

### ~~Table of contents inaccurate~~ ✅ Fixed (April 8)
TOC was picking up too many false positives from label-style patterns (`^[A-Z]...:`) and ALL-CAPS lines. Removed both patterns. Tightened numbered-section regex to require uppercase start and max 80 chars. Added deduplication and 40-entry cap.

### Chat state still resets on mode switch
Despite single ChatInterface instance, mode switching may cause remount. Needs React DevTools verification.

## Platform Issues

### Gmail OAuth / Email Integration
- Gmail MCP server needed for AI to search/send emails
- Google has official Gmail MCP: check if it's in our curated list
- OAuth flow: user connects Gmail → AI gets search/send tools
- Multiple email accounts per user: each connected as separate MCP server
- Privacy consideration: email access needs explicit user consent per account

### Schedule Runs Not Auto-Running
- Vercel Hobby cron is daily only (6am)
- When cron fires, the schedule executor needs ALL tools the prompt references
- Current executor only loads `search_context` — needs to load MCP tools too
- For tools like web_search, the executor needs those tools available
- Fix: load the same tools as main chat route in the schedule executor
- For real-time execution: need cron-job.org or Vercel Pro

### Duplicate Notifications
- Schedule notifications firing multiple times
- Should be exactly 2: one at start ("Executing..."), one at end (with synopsis)
- Check execute-schedules route for duplicate notify() calls
- The toast notification should show a brief synopsis of the result, not just "Complete"
- May be the 30-second polling in notification-bell.tsx re-triggering
