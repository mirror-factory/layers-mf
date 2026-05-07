/**
 * Cost tracker wire — joins kit cost calculation to Langfuse traces.
 *
 * `recordModelCall` is the single entry point the rest of Layers (and Symphony,
 * once it consumes these traces) should call after every server-side AI call.
 * It computes USD cost via `calculateCost` from `@mirror-factory/ai-dev-kit/core`
 * and emits a structured Langfuse trace with `{ model, tokensIn, tokensOut, cost,
 * ticketId? }` so per-ticket spend caps can be enforced.
 *
 * Candidate call sites in Layers (do not wire here — follow-up):
 *   - `src/lib/ai-call.ts` (`aiCall`) — the canonical wrapper.
 *   - `src/lib/ai/telemetry.ts` (`logAICall`) — already persists structured logs.
 */

import { calculateCost } from '@mirror-factory/ai-dev-kit/core';
import { getLangfuseClient } from './langfuse-init';

export interface RecordModelCallParams {
  /** Full model identifier, e.g. `anthropic/claude-sonnet-4-6`. */
  model: string;
  /** Input tokens (prompt). */
  tokensIn: number;
  /** Output tokens (completion). */
  tokensOut: number;
  /** Optional ticket / sprint issue id (e.g. Linear identifier). */
  ticketId?: string;
  /** Optional trace name override; defaults to `ai.model.call`. */
  traceName?: string;
  /** Free-form extra attributes attached to the trace. */
  metadata?: Record<string, unknown>;
}

export interface RecordModelCallResult {
  /** Computed USD cost for this call. Falls back to 0 for unknown models. */
  cost: number;
}

/**
 * Record a single model call: compute cost, emit a Langfuse trace.
 *
 * Synchronous w.r.t. trace emission (the underlying span processor batches),
 * so callers don't have to await network IO on the hot path.
 */
export function recordModelCall(params: RecordModelCallParams): RecordModelCallResult {
  const { model, tokensIn, tokensOut, ticketId, traceName, metadata } = params;

  const cost = calculateCost(model, tokensIn, tokensOut);

  const client = getLangfuseClient();
  client.trace(traceName ?? 'ai.model.call', {
    model,
    tokensIn,
    tokensOut,
    cost,
    ...(ticketId ? { ticketId } : {}),
    ...(metadata ?? {}),
  });

  return { cost };
}
