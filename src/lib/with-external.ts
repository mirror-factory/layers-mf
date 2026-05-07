/**
 * withExternalCall -- wrap non-AI-SDK external API calls for observability.
 *
 * AI SDK calls (`streamText`, `generateText`) are captured automatically by
 * the Langfuse OpenTelemetry integration. Everything else -- AssemblyAI,
 * Firecrawl, Deepgram, the Vercel API, any REST SDK -- is invisible to
 * Langfuse out of the box.
 *
 * This helper closes that gap. Wrap every external call so it:
 *   1. Logs structured start/end/error to the stdout sink
 *   2. Emits a Langfuse generation span when Langfuse is configured
 *      (silently no-ops when it isn't)
 *   3. Records duration, input summary, output summary
 *
 * Usage:
 *   const transcript = await withExternalCall(
 *     { vendor: 'assemblyai', operation: 'transcripts.submit', requestId },
 *     () => client.transcripts.submit({ audio_url, speech_models: ['universal-3-pro'] }),
 *     { inputSummary: { audioBytes: buf.length } },
 *   );
 *
 * If the call throws, the error is logged with full context and re-thrown
 * so upstream `withRoute()` can catch it. Never silences errors.
 */

import { log, toErrObject } from './logger';
import { getRunContext } from './run-context';
import { estimateVendorCostUsd, type UsageUnit } from './vendor-pricing';

interface ExternalCallMeta {
  vendor: string;       // 'assemblyai', 'firecrawl', etc.
  operation: string;    // 'transcripts.submit', 'scrape.url', etc.
  /** Registry model/product id matching a *_models entry for cost lookup. */
  modelId?: string;
  requestId?: string;
  userId?: string;
}

interface CallOptions<TResult> {
  inputSummary?: Record<string, unknown>;
  /** Summarize the result for logging (don't log full payloads). */
  summarizeResult?: (result: TResult) => Record<string, unknown>;
  /**
   * Usage to attribute cost against. Pricing comes from
   * `.ai-dev-kit/registries/<vendor>.*` via `estimateVendorCostUsd`.
   * Example: `{ unit: 'minute', amount: 12.4 }` for a 12m24s transcription.
   */
  usage?: {
    unit: UsageUnit;
    amount: number;
  };
}

// Langfuse is optional -- resolve it dynamically so the helper works with or
// without it installed. The `any` cast here is intentional: we only use the
// client if it successfully resolves and exposes `.generation()`.
let langfuseClient: unknown = null;
let langfuseInitAttempted = false;

async function getLangfuse(): Promise<{ generation: (args: Record<string, unknown>) => { end: (args?: Record<string, unknown>) => void; update: (args?: Record<string, unknown>) => void } } | null> {
  if (langfuseInitAttempted) return langfuseClient as ReturnType<typeof getLangfuse> extends Promise<infer T> ? T : never;
  langfuseInitAttempted = true;

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return null;
  }

  try {
    const mod = await import('langfuse').catch(() => null);
    if (!mod) return null;
    const Langfuse = (mod as { Langfuse?: new (args: Record<string, unknown>) => unknown }).Langfuse;
    if (!Langfuse) return null;
    langfuseClient = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
    });
    return langfuseClient as ReturnType<typeof getLangfuse> extends Promise<infer T> ? T : never;
  } catch (err) {
    log.warn('langfuse.init-failed', { err: toErrObject(err) });
    return null;
  }
}

export async function withExternalCall<TResult>(
  meta: ExternalCallMeta,
  fn: () => Promise<TResult>,
  options: CallOptions<TResult> = {},
): Promise<TResult> {
  const startedAt = Date.now();
  const { vendor, operation, modelId, requestId, userId } = meta;
  const run = getRunContext();

  // Compute attributed cost up-front (if usage provided). Lookup is
  // vendor+modelId → pricing.unit / usd_per_unit in the registry. Returns
  // null when the registry lacks pricing; the call still proceeds but the
  // dashboard's cost-by-vendor tab will flag the row as "unpriced".
  const estimatedCostUsd = options.usage
    ? estimateVendorCostUsd({ vendor, modelId, usage: options.usage })
    : null;

  log.info('external.start', {
    vendor,
    operation,
    modelId,
    requestId,
    userId,
    run_id: run.run_id,
    feature_name: run.feature_name,
    input: options.inputSummary,
  });

  const lf = await getLangfuse().catch(() => null);
  const span = lf?.generation({
    name: `${vendor}.${operation}`,
    metadata: {
      vendor,
      operation,
      modelId,
      requestId,
      userId,
      run_id: run.run_id,
      feature_name: run.feature_name,
    },
    input: options.inputSummary ?? null,
  });

  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt;
    const output = options.summarizeResult ? safeSummarize(options.summarizeResult, result) : undefined;

    log.info('external.end', {
      vendor,
      operation,
      modelId,
      requestId,
      durationMs,
      run_id: run.run_id,
      feature_name: run.feature_name,
      cost_source: 'vendor_api',
      estimated_cost_usd: estimatedCostUsd,
      usage_unit: options.usage?.unit,
      usage_amount: options.usage?.amount,
      output,
    });
    span?.end({ output: output ?? null });
    return result;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errObj = toErrObject(err);
    log.error('external.failed', {
      vendor,
      operation,
      modelId,
      requestId,
      durationMs,
      run_id: run.run_id,
      feature_name: run.feature_name,
      err: errObj,
    });
    span?.update({ level: 'ERROR', statusMessage: errObj.message });
    span?.end();
    throw err;
  }
}

function safeSummarize<T>(summarize: (r: T) => Record<string, unknown>, result: T): Record<string, unknown> | undefined {
  try { return summarize(result); } catch { return undefined; }
}
