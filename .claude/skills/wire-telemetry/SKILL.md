---
name: wire-telemetry
description: Ensure AI SDK calls and tools are wrapped with telemetry and logged for observability.
---

# Wire Telemetry Skill

> Ensure every AI call has proper observability. Use when writing or modifying code that calls `streamText`, `generateText`, or any AI SDK function.

## When to Use

- When writing a new API route that calls `streamText` or `generateText`
- When adding a new tool with an `execute` function that calls AI
- When modifying existing AI call sites
- When the compliance checker reports "AI calls missing telemetry"
- When adding a new model or provider

## The Pattern

Every AI call needs 3 things:

### 1. Wrap the model with `withTelemetry`

```typescript
import { withTelemetry, logAICall, logError } from '@/lib/ai/telemetry';

// In your route handler:
const ctx = {
  userId: user.id,         // From auth — who made this request
  sessionId: session.id,   // Browser session — groups requests
  chatId: chatId,          // Conversation ID — drills down to specific chat
  label: 'chat',           // Human-readable name for this call type
};

const model = withTelemetry(
  aiGateway('google/gemini-3-flash'),
  ctx
);
```

### 2. Log the completed call with `logAICall`

```typescript
const startTime = Date.now();
let firstTokenTime: number | null = null;

const result = streamText({
  model,  // Already wrapped with withTelemetry
  system: systemPrompt,
  messages,
  tools,
  onStepFinish: (step) => {
    if (!firstTokenTime) firstTokenTime = Date.now();
  },
});

// After stream completes (in onFinish or after consuming):
await logAICall({
  context: ctx,
  modelId: 'google/gemini-3-flash',
  usage: { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens },
  durationMs: Date.now() - startTime,
  ttftMs: firstTokenTime ? firstTokenTime - startTime : null,
  steps: result.steps?.length ?? 1,
  toolCalls: result.toolCalls?.map(tc => tc.toolName) ?? [],
  finishReason: result.finishReason,
  // Optional streaming metrics:
  tokensPerSecond: result.usage.completionTokens / ((Date.now() - startTime) / 1000),
  aborted: result.finishReason === 'abort',
});
```

### 3. Catch and log errors with `logError`

```typescript
try {
  const result = await streamText({ model, ... });
  // ... process result
} catch (err) {
  await logError({
    context: ctx,
    error: err,
    source: 'chat-route',  // or 'tool-execute', 'middleware', etc.
    modelId: 'google/gemini-3-flash',
  });
  throw err; // Re-throw so the error boundary handles it
}
```

### For tool execute functions:

```typescript
myTool: tool({
  description: '...',
  inputSchema: z.object({ ... }),
  execute: async (input) => {
    try {
      // ... tool logic that might call AI
      const result = await generateText({
        model: withTelemetry(aiGateway('google/gemini-3-flash'), {
          ...ctx,
          label: 'tool-myTool',  // Label identifies this specific tool
        }),
        prompt: '...',
      });

      await logAICall({
        context: { ...ctx, label: 'tool-myTool' },
        modelId: 'google/gemini-3-flash',
        usage: result.usage,
        durationMs: Date.now() - startTime,
        toolCalls: [],
      });

      return { success: true, data: result.text };
    } catch (err) {
      await logError({
        context: ctx,
        error: err,
        source: 'tool-execute',
        toolName: 'myTool',
        modelId: 'google/gemini-3-flash',
      });
      return { success: false, error: 'Tool execution failed' };
    }
  },
}),
```

## Labels to Use

Use consistent labels so the dashboard can group calls:

| Label | When |
|-------|------|
| `chat` | Main chat route (user messages) |
| `tool-{toolName}` | AI calls inside tool execute functions |
| `generate-image` | Image generation calls |
| `edit-component` | Component editing calls |
| `analyze` | Analysis/classification calls |
| `embed` | Embedding generation |
| `background` | Background/async tasks (auto-title, scheduling) |

## HTTP Request Logging (Optional)

To track all API requests (not just AI calls), add to `middleware.ts`:

```typescript
import { logHTTPRequest } from '@/lib/ai/telemetry';

export async function middleware(request: NextRequest) {
  const start = Date.now();
  const response = NextResponse.next();

  // Log after response (non-blocking)
  logHTTPRequest({
    method: request.method,
    path: request.nextUrl.pathname,
    status: response.status,
    durationMs: Date.now() - start,
    userId: request.headers.get('x-user-id') ?? null,
    userAgent: request.headers.get('user-agent') ?? null,
  }).catch(() => {}); // Fire and forget

  return response;
}
```

## Verification

After wiring telemetry:

1. Make an AI call in the app
2. Check that `.ai-logs/ai-logs-YYYY-MM-DD.json` has the new entry
3. Visit `/observability` — the call should appear in the table
4. Run `pnpm compliance` — "Telemetry enabled on AI calls" should pass

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot `await` on `logAICall` | Add `await` — otherwise the log may be lost on serverless |
| `withTelemetry` but no `logAICall` | Both are needed — middleware injects OTel, `logAICall` persists to our dashboard |
| `logAICall` without `withTelemetry` | Our dashboard works, but OTel-based services (Langfuse, Braintrust) won't see it |
| Hardcoded userId: 'anonymous' | Pass actual user ID from auth — enables per-user cost attribution |
| Missing `chatId` | Pass the conversation ID — enables session drill-down in dashboard |
| Error not caught | Wrap AI calls in try/catch, call `logError()` in catch |
