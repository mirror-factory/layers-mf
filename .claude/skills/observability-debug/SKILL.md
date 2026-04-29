---
name: observability-debug
description: Diagnose errors, performance issues, and unexpected AI behavior using observability.
---

# Observability Debug Skill

> Diagnose errors, performance issues, and unexpected AI behavior using the built-in observability system.

## When to Use

- When a user reports "something went wrong" or "it's slow"
- When a tool execution fails (you see error output in chat)
- When AI gives unexpected or wrong answers
- When streaming seems stuck or aborted
- When you need to understand what happened in a specific chat session
- When debugging cost spikes or TTFT regressions
- After any error in `app/api/chat/route.ts` or tool execute functions

## Diagnostic Workflow

### Step 1: Check Error Logs

Read the most recent error log file:

```bash
# File backend (default)
ls -la .ai-logs/ai-errors-*.json | tail -1
cat .ai-logs/ai-errors-$(date +%Y-%m-%d).json | tail -20

# Or via API (if dev server running)
curl -s http://localhost:3000/api/ai-logs/errors?limit=10 | jq .
```

Look for:
- `source`: Where did the error originate? (`chat-route`, `tool-execute`, `stream-drop`, `middleware`)
- `message`: The actual error message
- `stack`: Full stack trace — find the originating file and line
- `toolName`: If a specific tool failed
- `modelId`: If a specific model is the problem

### Step 2: Check AI Call Logs

```bash
# Recent calls with errors
cat .ai-logs/ai-logs-$(date +%Y-%m-%d).json | jq '[.[] | select(.error != null)]'

# Calls for a specific chat
cat .ai-logs/ai-logs-$(date +%Y-%m-%d).json | jq '[.[] | select(.chatId == "CHAT_ID")]'

# Slow calls (TTFT > 3 seconds)
cat .ai-logs/ai-logs-$(date +%Y-%m-%d).json | jq '[.[] | select(.ttftMs > 3000)]'

# Aborted calls
cat .ai-logs/ai-logs-$(date +%Y-%m-%d).json | jq '[.[] | select(.aborted == true)]'

# Or via API
curl -s "http://localhost:3000/api/ai-logs?errorsOnly=true&limit=10" | jq .
curl -s "http://localhost:3000/api/ai-logs?chatId=CHAT_ID" | jq .
```

### Step 3: Check Aggregated Stats

```bash
curl -s http://localhost:3000/api/ai-logs/stats | jq '{
  errorRate, totalErrors, avgTTFT, p95TTFT, totalCost,
  topErrors: [.errorsByDay | to_entries | sort_by(.value) | reverse | .[0:3]],
  costByDay: .costByDay
}'
```

Look for:
- `errorRate` > 5%: Something systemic is wrong
- `p95TTFT` > 5s: Model or network performance issue
- `costByDay` trending up: Possible prompt bloat or unnecessary tool calls

### Step 4: Check Server Terminal

Look for `CHAT ROUTE ERROR:` or `[AI:label]` log lines in the terminal where `pnpm dev` is running.

### Step 5: Check Browser Console

If you have Chrome MCP tools, use `mcp__claude-in-chrome__read_console_messages` to check for client-side errors.

## Common Error Patterns

| Error | Source | Likely Cause | Fix |
|-------|--------|-------------|-----|
| `400 Bad Request` | `chat-route` | Invalid tool schema, Gemini rejects `z.union()` | Use `z.enum()`, check provider schema restrictions |
| `429 Too Many Requests` | `chat-route` | Rate limited by provider | Add retry with exponential backoff, check rate limit config |
| `tool-execute` error with tool name | `tool-execute` | Bug in tool's execute function | Read the tool's execute function, check the stack trace |
| `stream-drop` | `stream-drop` | Client disconnected, timeout | Check stream timeout settings, client abort handling |
| TTFT > 10s | N/A (not an error) | Large context, slow model | Reduce context budget, use faster model, enable caching |
| `thought_signature` error | `chat-route` | Gemini 3.x multi-step with thinking | Use `thinkingBudget: 0` or gemini-2.5-flash for multi-step |
| Cost spike | N/A | Prompt bloat, base64 in messages | Check message history size, ensure tool output is compact |

## File Locations

| What | Where |
|------|-------|
| AI call logs (file backend) | `.ai-logs/ai-logs-YYYY-MM-DD.json` |
| Error logs (file backend) | `.ai-logs/ai-errors-YYYY-MM-DD.json` |
| HTTP logs (file backend) | `.ai-logs/http-logs-YYYY-MM-DD.json` |
| Telemetry middleware | `lib/ai/telemetry.ts` |
| Dashboard page | `app/observability/page.tsx` |
| API: list logs | `app/api/ai-logs/route.ts` |
| API: stats | `app/api/ai-logs/stats/route.ts` |
| API: errors | `app/api/ai-logs/errors/route.ts` |
| Chat route (main error source) | `app/api/chat/route.ts` |
| Tool definitions | `lib/ai/tools/` |
| Dev debug panel | `components/ai-debug-panel.tsx` (Cmd+Shift+D) |

## When Logs Aren't Enough

If the built-in observability doesn't have what you need:

1. **Need prompt/response content**: Use `@ai-sdk/devtools` — run `npx @ai-sdk/devtools`, opens localhost:4983 with full request/response viewer
2. **Need real-time streaming debug**: Add `console.log` in the tool's execute function (temporary), check server terminal
3. **Need to see what the model "thinks"**: Check if reasoning parts are being rendered — the model may be thinking but the UI discards it
4. **Need production alerting**: Wire Langfuse or Sentry (see `guides/OBSERVABILITY.md`)
