/**
 * Unified log aggregator -- pull recent events from every configured sink.
 *
 * The kit's observability story has multiple layers:
 *   - stdout ring (always on, via lib/logger.ts + lib/sink-stats.ts)
 *   - file tail (.ai-logs/*.json, via ai-telemetry-middleware's file backend)
 *   - Supabase (persistent; via telemetry middleware)
 *   - Langfuse (AI-SDK traces; via instrumentation.ts)
 *   - dev3000 (dev-only timestamped feed at ~/.d3k/<project>/d3k.log)
 *
 * This module normalizes events across those sinks into a single shape
 * and returns them sorted by timestamp. The dashboard route
 * /api/dev-kit/logs/unified consumes this so the user never has to
 * cross-reference five tabs to figure out what happened.
 *
 * Contract: if a sink is unconfigured or unreachable, it returns an empty
 * list -- never throws. The aggregator degrades; it does not black-hole.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface UnifiedEvent {
  ts: string;              // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error' | 'unknown';
  source: 'stdout' | 'file' | 'supabase' | 'langfuse' | 'dev3000';
  event: string;           // event name or category
  message: string;         // human-readable
  requestId?: string;
  userId?: string;
  raw?: unknown;           // original payload for debugging
}

interface FetchOptions {
  limit?: number;
  sinceIso?: string;
  sources?: UnifiedEvent['source'][];
}

function safeParseTs(v: unknown): number {
  if (typeof v !== 'string') return 0;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

/**
 * File-tail backend: reads .ai-logs/*.json (produced by the file backend
 * in ai-telemetry-middleware).
 */
async function fetchFile(cwd: string, opts: FetchOptions): Promise<UnifiedEvent[]> {
  const dir = join(cwd, '.ai-logs');
  if (!existsSync(dir)) return [];
  const cutoff = opts.sinceIso ? Date.parse(opts.sinceIso) : 0;
  const out: UnifiedEvent[] = [];
  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
    for (const f of files) {
      const full = join(dir, f);
      try {
        const body = JSON.parse(readFileSync(full, 'utf-8')) as Array<Record<string, unknown>>;
        for (const rec of body) {
          const ts = safeParseTs(rec.timestamp ?? rec.ts);
          if (cutoff && ts < cutoff) continue;
          out.push({
            ts: new Date(ts || Date.now()).toISOString(),
            level: (rec.error ? 'error' : 'info') as UnifiedEvent['level'],
            source: 'file',
            event: String(rec.label ?? rec.source ?? 'file-log'),
            message: String(rec.message ?? rec.modelId ?? rec.path ?? ''),
            requestId: (rec.id ?? rec.requestId) as string | undefined,
            userId: rec.userId as string | undefined,
            raw: rec,
          });
        }
      } catch { /* skip malformed file */ }
      if (opts.limit && out.length >= opts.limit * 2) break;
    }
  } catch { /* unreadable dir */ }
  return out;
}

/**
 * Supabase backend: query ai_logs + ai_errors if a client is configured.
 * Degrades to empty when env vars are missing so unconfigured projects
 * don't see "supabase unreachable" errors they can't fix.
 */
async function fetchSupabase(opts: FetchOptions): Promise<UnifiedEvent[]> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const limit = opts.limit ?? 100;
    const params = new URLSearchParams({
      select: '*',
      order: 'timestamp.desc',
      limit: String(limit),
    });
    if (opts.sinceIso) params.append('timestamp', `gte.${opts.sinceIso}`);
    const res = await fetch(`${url}/rest/v1/ai_logs?${params.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      ts: String(r.timestamp ?? new Date().toISOString()),
      level: (r.error ? 'error' : 'info') as UnifiedEvent['level'],
      source: 'supabase',
      event: String(r.label ?? 'ai-call'),
      message: `${r.modelId ?? ''} ${r.error ?? ''}`.trim(),
      requestId: r.id as string | undefined,
      userId: r.userId as string | undefined,
      raw: r,
    }));
  } catch {
    return [];
  }
}

/**
 * Langfuse trace search. Only returns recent generations; full traces
 * require authenticated links to the Langfuse UI.
 */
async function fetchLangfuse(opts: FetchOptions): Promise<UnifiedEvent[]> {
  const pk = process.env.LANGFUSE_PUBLIC_KEY;
  const sk = process.env.LANGFUSE_SECRET_KEY;
  const base = process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com';
  if (!pk || !sk) return [];
  try {
    const auth = Buffer.from(`${pk}:${sk}`).toString('base64');
    const limit = opts.limit ?? 50;
    const res = await fetch(`${base}/api/public/generations?limit=${limit}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    return (json.data ?? []).map(g => ({
      ts: String(g.startTime ?? g.timestamp ?? new Date().toISOString()),
      level: 'info' as const,
      source: 'langfuse',
      event: String(g.name ?? 'langfuse-gen'),
      message: String(g.model ?? ''),
      requestId: g.traceId as string | undefined,
      raw: g,
    }));
  } catch {
    return [];
  }
}

/**
 * dev3000 backend: tail ~/.d3k/<project>/d3k.log if the developer is
 * running `d3k` locally. Dev-mode only; silently absent in prod.
 */
async function fetchDev3000(cwd: string, opts: FetchOptions): Promise<UnifiedEvent[]> {
  try {
    const projectName = (JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8')) as { name?: string }).name ?? 'project';
    const logPath = join(homedir(), '.d3k', projectName.replace(/[^\w.-]/g, '_'), 'd3k.log');
    if (!existsSync(logPath)) return [];
    const st = statSync(logPath);
    // Guard against huge tails: only read the last 256KB
    const maxRead = 256 * 1024;
    const start = Math.max(0, st.size - maxRead);
    const { openSync, readSync, closeSync } = await import('fs');
    const fd = openSync(logPath, 'r');
    const buf = Buffer.alloc(st.size - start);
    readSync(fd, buf, 0, buf.length, start);
    closeSync(fd);
    const lines = buf.toString('utf-8').split('\n').filter(Boolean);
    return lines.slice(-(opts.limit ?? 100)).map(line => {
      // [09:12:04] BROWSER console.error "..."
      const m = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s+(\w+)\s+(.+)$/);
      if (!m) return { ts: new Date().toISOString(), level: 'unknown' as const, source: 'dev3000' as const, event: 'raw', message: line };
      const today = new Date().toISOString().slice(0, 10);
      return {
        ts: `${today}T${m[1]}Z`,
        level: (m[3].toLowerCase().includes('error') ? 'error' : 'info') as UnifiedEvent['level'],
        source: 'dev3000' as const,
        event: m[2].toLowerCase(),
        message: m[3],
      };
    });
  } catch {
    return [];
  }
}

/**
 * Aggregate recent events across all configured sinks. Returns them
 * sorted by timestamp (newest first).
 */
export async function fetchUnified(cwd: string, opts: FetchOptions = {}): Promise<UnifiedEvent[]> {
  const sources = new Set(opts.sources ?? (['stdout', 'file', 'supabase', 'langfuse', 'dev3000'] as UnifiedEvent['source'][]));
  const collected: UnifiedEvent[] = [];

  await Promise.all([
    sources.has('file')      ? fetchFile(cwd, opts).then(r => collected.push(...r))     : Promise.resolve(),
    sources.has('supabase')  ? fetchSupabase(opts).then(r => collected.push(...r))      : Promise.resolve(),
    sources.has('langfuse')  ? fetchLangfuse(opts).then(r => collected.push(...r))      : Promise.resolve(),
    sources.has('dev3000')   ? fetchDev3000(cwd, opts).then(r => collected.push(...r))  : Promise.resolve(),
  ]);

  collected.sort((a, b) => b.ts.localeCompare(a.ts));
  return opts.limit ? collected.slice(0, opts.limit) : collected;
}

/**
 * Return a status map of which sinks appear configured. Dashboard uses
 * this to show the user which pipelines are receiving events.
 */
export function configuredSinks(cwd: string): Record<UnifiedEvent['source'], boolean> {
  const hasFile = existsSync(join(cwd, '.ai-logs'));
  const hasSupabase = Boolean(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY),
  );
  const hasLangfuse = Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
  let projectName = 'project';
  try { projectName = (JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8')) as { name?: string }).name ?? 'project'; } catch {}
  const hasDev3000 = existsSync(join(homedir(), '.d3k', projectName.replace(/[^\w.-]/g, '_'), 'd3k.log'));
  return { stdout: true, file: hasFile, supabase: hasSupabase, langfuse: hasLangfuse, dev3000: hasDev3000 };
}
