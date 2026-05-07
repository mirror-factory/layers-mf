/**
 * Next.js OpenTelemetry instrumentation hook.
 *
 * Runs once per server process (Node.js + Edge runtimes). We register
 * `@vercel/otel` for the standard Next.js spans and attach
 * `@langfuse/otel`'s `LangfuseSpanProcessor` so AI SDK telemetry (and the
 * explicit traces emitted by `getLangfuseClient().trace(...)`) flow into
 * Langfuse.
 *
 * Langfuse credentials come from env (`LANGFUSE_PUBLIC_KEY`,
 * `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`); if they're missing, the span
 * processor still runs but ingestion is skipped — matching the noop
 * fallback in `src/lib/observability/langfuse-init.ts`.
 */

import { registerOTel } from '@vercel/otel';
import { LangfuseSpanProcessor } from '@langfuse/otel';

export function register() {
  // Edge runtime can't use the Langfuse OTel processor (no Node APIs); only
  // wire it for the Node.js server runtime.
  if (process.env.NEXT_RUNTIME === 'edge') {
    registerOTel({ serviceName: 'layers-mf' });
    return;
  }

  const spanProcessor = new LangfuseSpanProcessor({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
    // Use immediate mode in serverless / Vercel; batched is fine on long-lived
    // self-hosted Node processes. We pick based on `VERCEL` env.
    exportMode: process.env.VERCEL ? 'immediate' : 'batched',
  });

  registerOTel({
    serviceName: 'layers-mf',
    spanProcessors: [spanProcessor],
  });
}
