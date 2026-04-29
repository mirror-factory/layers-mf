/**
 * Structured stdout logger -- the always-on base sink.
 *
 * Runs with zero environment variables. Emits one JSON line per event to
 * stdout so logs survive even when Langfuse, Supabase, or other backends
 * are unconfigured or failing. Upstream sinks layer on top of this, not
 * instead of it.
 *
 * Design rules:
 *   1. Cannot throw. Ever. A logger that crashes while logging is worse
 *      than no logger at all.
 *   2. No external dependencies at import time. A missing npm package
 *      should not break the logger.
 *   3. Every entry has `ts`, `level`, `event`, `requestId` (when known).
 *
 * Usage:
 *   import { log } from '@/lib/logger';
 *   log.info('transcribe.start', { userId, bytes });
 *   log.error('transcribe.failed', { requestId, err: toErrObject(err) });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    // Circular reference or unserializable value. Fall back to a summary.
    try {
      return JSON.stringify({ __unserializable: String(value) });
    } catch {
      return '"__unserializable"';
    }
  }
}

function emit(level: LogLevel, event: string, ctx?: LogContext) {
  if (!shouldEmit(level)) return;
  try {
    const line = safeStringify({
      ts: new Date().toISOString(),
      level,
      event,
      ...ctx,
    });
    // Errors go to stderr so they're visible even when stdout is redirected.
    if (level === 'error' || level === 'warn') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  } catch {
    // Absolute last resort: swallow. See design rule #1.
  }
}

export const log = {
  debug: (event: string, ctx?: LogContext) => emit('debug', event, ctx),
  info: (event: string, ctx?: LogContext) => emit('info', event, ctx),
  warn: (event: string, ctx?: LogContext) => emit('warn', event, ctx),
  error: (event: string, ctx?: LogContext) => emit('error', event, ctx),
};

/**
 * Convert an unknown thrown value into a JSON-safe object. Preserves name,
 * message, and stack when the value is an Error; otherwise coerces to string.
 */
export function toErrObject(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: 'NonError', message: String(err) };
}
