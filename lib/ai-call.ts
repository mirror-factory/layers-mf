/**
 * aiCall -- single-function wrapper combining withTelemetry + logAICall.
 *
 * Problem this solves: the manual pattern is
 *
 *   const model = withTelemetry(gateway(modelId), ctx);
 *   const result = await streamText({ model, prompt });
 *   // ... stream consumption ...
 *   await logAICall({ context: ctx, modelId, usage: ..., durationMs: ..., finishReason });
 *
 * Five lines of ceremony per call; easy to forget the logAICall on the end,
 * at which point /dev-kit/sessions shows nothing and cost tracking is zero.
 *
 * aiCall collapses both steps AND routes through the Claude Code local
 * provider when LOCAL_TEST=1 + model is anthropic/*. Each log record gets
 * a costMode tag ('subscription' | 'billable' | 'local') so /dev-kit/cost
 * can split real vs test costs.
 *
 * Usage:
 *   import { aiCall } from '@/lib/ai-call';
 *   const { text, usage } = await aiCall({
 *     mode: 'generate',
 *     modelId: models.generator,
 *     prompt: 'Summarize: ' + transcript,
 *     label: 'summarize-meeting',
 *     userId,
 *   });
 *
 *   // Streaming:
 *   const stream = await aiCall({
 *     mode: 'stream',
 *     modelId: models.generator,
 *     messages,
 *     label: 'chat',
 *     userId,
 *   });
 *   // consume stream.textStream; the wrapper logs automatically when done.
 *
 * Doctor still enforces the underlying primitives: if a file calls
 * streamText directly without withTelemetry, the check still fires.
 * aiCall is the preferred entry point because forgetting logAICall
 * becomes impossible and costMode gets tagged correctly.
 */

import { streamText, generateText } from 'ai';
import { resolveModel } from './model-router';
import { withTelemetry, logAICall, logError, type TelemetryContext } from './ai/telemetry';
import { log, toErrObject } from './logger';
import { getRunContext, runContextToMetadata } from './run-context';

type GenerateArgs = Parameters<typeof generateText>[0];
type StreamArgs = Parameters<typeof streamText>[0];

type BaseArgs = {
  modelId: string;
  label: string;
  userId?: string;
  sessionId?: string;
  chatId?: string;
  metadata?: Record<string, string>;
};

type AiCallArgs =
  | ({ mode: 'generate' } & BaseArgs & Omit<GenerateArgs, 'model'>)
  | ({ mode: 'stream' } & BaseArgs & Omit<StreamArgs, 'model'>);

export async function aiCall(args: AiCallArgs) {
  const { mode, modelId, label, userId, sessionId, chatId, metadata, ...rest } = args;

  // Pull active run context (set by Claude Code SessionStart hook, the
  // `ai-dev-kit run` CLI, or env vars in headless contexts). When absent,
  // these fields are null and the call still logs -- correlation is a
  // best-effort overlay, not a hard requirement.
  const run = getRunContext();

  const ctx: TelemetryContext = {
    userId,
    sessionId,
    chatId: chatId ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `chat-${Date.now()}`),
    label,
    metadata: {
      ...runContextToMetadata(run),
      ...(metadata ?? {}),
    },
  };

  // Resolve model + costMode. Claude-only LOCAL_TEST routes through the
  // community Claude Code provider (subscription = free). Everything else
  // goes through Gateway (subscription in dev, billable in prod).
  const { model: baseModel, costMode } = await resolveModel(modelId);
  const model = withTelemetry(baseModel, ctx);
  ctx.metadata = { ...ctx.metadata, costMode };

  const startedAt = Date.now();

  try {
    if (mode === 'generate') {
      const result = await generateText({ model, ...(rest as Omit<GenerateArgs, 'model'>) } as GenerateArgs);
      await logAICall({
        context: ctx,
        modelId,
        usage: {
          promptTokens: result.usage?.inputTokens ?? 0,
          completionTokens: result.usage?.outputTokens ?? 0,
        },
        durationMs: Date.now() - startedAt,
        finishReason: result.finishReason,
        toolCalls: result.toolCalls?.map(t => t.toolName) ?? [],
      });
      return result;
    }

    const result = streamText({ model, ...(rest as Omit<StreamArgs, 'model'>) } as StreamArgs);

    (async () => {
      try {
        const [finishReason, usage] = await Promise.all([result.finishReason, result.usage]);
        await logAICall({
          context: ctx,
          modelId,
          usage: {
            promptTokens: usage?.inputTokens ?? 0,
            completionTokens: usage?.outputTokens ?? 0,
          },
          durationMs: Date.now() - startedAt,
          finishReason: String(finishReason ?? 'unknown'),
        });
      } catch (err) {
        log.error('ai-call.stream-finalize-failed', { label, costMode, err: toErrObject(err) });
      }
    })();

    return result;
  } catch (err) {
    await logError({ context: ctx, error: err, source: 'ai-call', modelId });
    throw err;
  }
}
