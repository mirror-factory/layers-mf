# Session 6 Backlog

> Issues identified during session 5 (April 7-8, 2026) that need dedicated attention.

## Portal Issues

### Zoom not working
PDF viewer zoom buttons (+/-/reset) exist in the header but pages don't resize. The `pageWidth` calculation depends on `zoom` state but the zoom buttons may not be connected to the PDF viewer's controls properly. Check `PdfControls.zoomIn/zoomOut` wiring.

### Search/highlight goes to wrong position
PDF search and highlight_text tool highlights appear at incorrect positions (top-left corner of page instead of at the matching text). The `highlightTextInDom` function finds text spans in the react-pdf text layer but the mark elements aren't positioned correctly. Need to verify TextLayer.css is working and that mark elements inherit the span's absolute positioning within the text layer.

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
