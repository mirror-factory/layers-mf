/**
 * Tools API  --  GET /api/dev-kit/tools
 *
 * Source of truth: `.ai-dev-kit/registries/tools.yaml`, written by
 * scripts/sync-registries.ts. No Supabase round-trip, no network calls; if the
 * dashboard is reachable the data is reachable.
 *
 * Returns the full tool registry in the shape /dev-kit/tools expects --
 * a flat array of Tool records. The historic Supabase-backed shape returned
 * a bare array; we keep that as `tools` inside an envelope plus a top-level
 * `data` alias so the page's `Array.isArray(d) ? d : d.data ?? []` fallback
 * still lights up.
 *
 * Failure and empty states get a `reason` + `endpoint` + `detail` envelope
 * so the UI can say something useful instead of "Failed to fetch".
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { logKitEvent } from '@/lib/kit-audit';

export const dynamic = 'force-dynamic';

const ENDPOINT = '/api/dev-kit/tools';
const TOOLS_YAML_REL = '.ai-dev-kit/registries/tools.yaml';

function coerceScalar(raw: string): unknown {
  const v = raw.trim().replace(/^["']|["']$/g, '');
  if (v === '' || v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

function parseSimpleRegistry(src: string): {
  kind: string;
  last_synced_on: string | null;
  entries: Array<Record<string, unknown>>;
} {
  const lines = src.split('\n');
  const out = {
    kind: 'tools',
    last_synced_on: null as string | null,
    entries: [] as Array<Record<string, unknown>>,
  };
  let inEntries = false;
  let current: Record<string, unknown> | null = null;
  const commit = () => {
    if (current && Object.keys(current).length > 0) out.entries.push(current);
    current = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!inEntries) {
      const k = line.match(/^kind:\s*(.+)$/);
      if (k) { out.kind = k[1].trim(); continue; }
      const s = line.match(/^last_synced_on:\s*(.+)$/);
      if (s) {
        const val = s[1].trim();
        out.last_synced_on = val === 'null' || val === '~' ? null : val.replace(/^["']|["']$/g, '');
        continue;
      }
      if (/^entries:\s*(\[\]|)\s*$/.test(line)) { inEntries = true; continue; }
    } else {
      const itemStart = line.match(/^\s+-\s+([a-z_]+):\s*(.*)$/);
      if (itemStart) {
        commit();
        current = {};
        current[itemStart[1]] = coerceScalar(itemStart[2]);
        continue;
      }
      const kv = line.match(/^\s+([a-z_]+):\s*(.*)$/);
      if (kv && current) current[kv[1]] = coerceScalar(kv[2]);
    }
  }
  commit();
  return out;
}

/**
 * Shape the raw registry entry into what /dev-kit/tools expects. The page
 * reads `name`, `description`, `category`, `permissionTier`, `testStatus`,
 * `lastEvalScore`, `costEstimate`, `schema`, `testFilePath`, `evalHistory`.
 * The registry only populates a subset; missing fields get sensible defaults
 * so the UI never crashes on undefined access.
 */
function shapeTool(entry: Record<string, unknown>): Record<string, unknown> {
  const name = String(entry.name ?? entry.path ?? 'unknown');
  const hasTest = entry.has_test === true;
  return {
    id: String(entry.path ?? name),
    name,
    description: (entry.description as string | null) ?? '',
    category: (entry.category as string | null) ?? 'general',
    permissionTier: (entry.permission_tier as string | null) ?? 'explorer',
    testStatus: hasTest ? 'passing' : 'untested',
    lastEvalScore: typeof entry.description_score === 'number'
      ? Math.round((entry.description_score as number) * 100)
      : null,
    costEstimate: (entry.cost_estimate as string | null) ?? '--',
    schema: {},
    testFilePath: hasTest
      ? String(entry.path ?? '').replace(/\.ts$/, '.test.ts')
      : null,
    evalHistory: [],
    // Pass-through raw fields the sync writer produces so power users can
    // introspect in the expanded row if we add a "raw" view later.
    path: entry.path ?? null,
    owner: entry.owner ?? null,
    has_test: hasTest,
    invocation_count: entry.invocation_count ?? null,
    last_invoked_at: entry.last_invoked_at ?? null,
  };
}

export async function GET() {
  const startedAt = Date.now();
  const cwd = process.cwd();
  const abs = join(cwd, TOOLS_YAML_REL);

  if (!existsSync(abs)) {
    logKitEvent({ kind: 'dashboard_api', name: ENDPOINT, phase: 'end', outcome: 'empty', duration_ms: Date.now() - startedAt, reason: 'tools.yaml missing' });
    return NextResponse.json({
      tools: [],
      data: [],
      empty: true,
      reason: 'tools.yaml not synced yet -- run `pnpm exec tsx scripts/sync-registries.ts`',
      endpoint: ENDPOINT,
    });
  }

  let src: string;
  try {
    src = readFileSync(abs, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logKitEvent({ kind: 'dashboard_api', name: ENDPOINT, phase: 'end', outcome: 'fail', duration_ms: Date.now() - startedAt, reason: 'tools.yaml unreadable', error: message.slice(0, 500) });
    return NextResponse.json(
      {
        error: 'tools_read_failed',
        reason: 'tools.yaml exists but could not be read -- check filesystem permissions',
        detail: message.slice(0, 300),
        endpoint: ENDPOINT,
      },
      { status: 500 },
    );
  }

  let parsed;
  try {
    parsed = parseSimpleRegistry(src);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logKitEvent({ kind: 'dashboard_api', name: ENDPOINT, phase: 'end', outcome: 'fail', duration_ms: Date.now() - startedAt, reason: 'tools.yaml unparseable', error: message.slice(0, 500) });
    return NextResponse.json(
      {
        error: 'tools_parse_failed',
        reason: 'tools.yaml exists but could not be parsed -- delete it and re-run `pnpm exec tsx scripts/sync-registries.ts`',
        detail: message.slice(0, 300),
        endpoint: ENDPOINT,
      },
      { status: 500 },
    );
  }

  const tools = parsed.entries
    .filter(e => !e.removed_on)
    .map(shapeTool);

  if (tools.length === 0) {
    logKitEvent({ kind: 'dashboard_api', name: ENDPOINT, phase: 'end', outcome: 'empty', duration_ms: Date.now() - startedAt, reason: 'no tools registered' });
    return NextResponse.json({
      tools: [],
      data: [],
      empty: true,
      reason: 'no tools registered -- add one under lib/ai/tools/<name>.ts then run `pnpm exec tsx scripts/sync-registries.ts`',
      endpoint: ENDPOINT,
      last_synced_on: parsed.last_synced_on,
    });
  }

  logKitEvent({ kind: 'dashboard_api', name: ENDPOINT, phase: 'end', outcome: 'ok', duration_ms: Date.now() - startedAt, meta: { count: tools.length } });
  return NextResponse.json({
    tools,
    data: tools,
    last_synced_on: parsed.last_synced_on,
    ts: new Date().toISOString(),
  });
}
