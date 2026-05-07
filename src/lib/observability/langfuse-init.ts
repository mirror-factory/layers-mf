/**
 * Langfuse client init — RED pillar of the Symphony observability audit.
 *
 * Provides a thin facade with two flavors:
 *   - `'real'` — real `LangfuseClient` (`@langfuse/client`) wired up when
 *     `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are both present.
 *   - `'noop'` — silent fallback when those env vars are missing, so the rest
 *     of the codebase can call `.trace()` and `.flush()` unconditionally
 *     without guards (and without crashing in dev/test).
 *
 * The OTel wiring (`LangfuseSpanProcessor` + `@vercel/otel` registration) lives
 * in `src/instrumentation.ts`; this module is purely the client-side handle
 * used to create explicit spans and to flush on shutdown.
 *
 * Env vars (see `.env.example`):
 *   LANGFUSE_PUBLIC_KEY   Project public key (`pk_lf_...`)
 *   LANGFUSE_SECRET_KEY   Project secret key (`sk_lf_...`)
 *   LANGFUSE_HOST         Optional ingest URL (defaults to Langfuse Cloud)
 */

import { LangfuseClient } from '@langfuse/client';
import { startActiveObservation } from '@langfuse/tracing';

export type LangfuseClientKind = 'real' | 'noop';

export interface LangfuseClientFacade {
  kind: LangfuseClientKind;
  /**
   * Emit a Langfuse trace with the given name and attributes. Safe to call
   * unconditionally — on a noop client this is a no-op.
   */
  trace: (name: string, attributes?: Record<string, unknown>) => void;
  /**
   * Flush any in-flight events. Safe to call from `process.on('beforeExit')`
   * or a Next.js shutdown handler.
   */
  flush: () => Promise<void>;
  /** Underlying real client if `kind === 'real'`. Useful for prompt mgmt. */
  raw?: LangfuseClient;
}

let cached: LangfuseClientFacade | null = null;

function buildNoopClient(): LangfuseClientFacade {
  return {
    kind: 'noop',
    trace: () => {
      // Intentionally empty — callers can `.trace()` without checking env.
    },
    flush: async () => {
      // Nothing to flush.
    },
  };
}

function buildRealClient(): LangfuseClientFacade {
  const raw = new LangfuseClient({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  return {
    kind: 'real',
    raw,
    trace: (name, attributes) => {
      // `startActiveObservation` opens an OTel span via `@langfuse/tracing`;
      // the configured `LangfuseSpanProcessor` (registered in
      // `src/instrumentation.ts`) routes it to Langfuse.
      startActiveObservation(
        name,
        (span) => {
          if (attributes) {
            for (const [key, value] of Object.entries(attributes)) {
              try {
                span.update({ metadata: { [key]: value } });
              } catch {
                // Ignore individual attribute failures so a bad value can't
                // break the whole trace.
              }
            }
          }
        },
        { asType: 'span' },
      );
    },
    flush: async () => {
      try {
        await raw.flush();
      } catch {
        // Swallow — flush is best-effort.
      }
    },
  };
}

/**
 * Get (and lazily construct) the process-wide Langfuse client facade.
 *
 * Memoized so repeated calls return the same instance, which matches the
 * lifecycle Langfuse expects (one client per process).
 */
export function getLangfuseClient(): LangfuseClientFacade {
  if (cached) return cached;

  const hasKeys = Boolean(
    process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
  );

  cached = hasKeys ? buildRealClient() : buildNoopClient();
  return cached;
}

/**
 * Reset the cached client. Intended for tests only — production code should
 * never need this.
 *
 * @internal
 */
export function __resetLangfuseClientForTests(): void {
  cached = null;
}
