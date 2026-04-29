/**
 * GET /api/dev-kit/registries -- list every registry in the project.
 *
 * Two shapes are walked:
 *   * .ai-dev-kit/registries/*.yaml  -- project-level registries written by
 *     scripts/sync-registries.ts (components, pages, tools, skills, api-routes,
 *     mcp-servers, design-tokens, design-system, dependencies, test-contracts).
 *   * .ai-dev-kit/registries/*.json  -- vendor registries (anthropic, openai,
 *     assemblyai, ...) authored / refreshed by `ai-dev-kit registry`.
 *
 * The YAMLs are parsed with the same hand-rolled, dependency-free line parser
 * used by scripts/sync-registries.ts -- NOT js-yaml. That parser knows the
 * exact shape the sync tool writes (kind / schema_version / last_synced_on /
 * entries: list of flat records) so there's no YAML library dependency in the
 * API surface and no drift between writer + reader.
 *
 * Response:
 *   { ts, registries: [
 *       { kind, path, last_synced_on, entries_count, entries, ...vendor fields },
 *       ...
 *     ] }
 *
 * Empty / missing cases use a `reason` field (not an error status) so the UI
 * can show a helpful empty state instead of a red banner.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { logKitEvent } from '@/lib/kit-audit';

export const dynamic = 'force-dynamic';

interface RegistryEntry {
  kind: string;
  path: string;
  schema_version?: number;
  last_synced_on: string | null;
  entries_count: number;
  entries: Array<Record<string, unknown>>;
  // Vendor JSON extras (kept for dashboards that still key off them).
  vendor?: string;
  label?: string;
  docs_root?: string;
  console_url?: string;
  validated_on?: string;
  ageDays?: number;
  stale?: boolean;
  required_env?: string[];
  deprecations?: unknown[];
  slots?: Record<string, unknown[]>;
  parse_error?: string;
}

function coerceScalar(raw: string): unknown {
  const v = raw.trim().replace(/^["']|["']$/g, '');
  if (v === '' || v === 'null' || v === '~') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

/**
 * Parse the minimal YAML shape written by scripts/sync-registries.ts. The
 * writer produces a flat header + `entries:` list where each item is a block
 * of `key: value` lines indented under a leading dash. Anything that isn't
 * that exact shape (nested maps, multi-line scalars) is silently ignored --
 * this parser is deliberately not a full YAML implementation.
 */
function parseSimpleRegistry(src: string, fallbackKind: string): {
  kind: string;
  schema_version?: number;
  last_synced_on: string | null;
  entries: Array<Record<string, unknown>>;
} {
  const lines = src.split('\n');
  const out = {
    kind: fallbackKind,
    schema_version: undefined as number | undefined,
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
      const v = line.match(/^schema_version:\s*(\d+)$/);
      if (v) { out.schema_version = Number(v[1]); continue; }
      const s = line.match(/^last_synced_on:\s*(.+)$/);
      if (s) {
        const val = s[1].trim();
        out.last_synced_on = val === 'null' || val === '~' ? null : val.replace(/^["']|["']$/g, '');
        continue;
      }
      if (/^entries:\s*(\[\]|)\s*$/.test(line)) {
        inEntries = true;
        continue;
      }
    } else {
      const itemStart = line.match(/^\s+-\s+([a-z_]+):\s*(.*)$/);
      if (itemStart) {
        commit();
        current = {};
        current[itemStart[1]] = coerceScalar(itemStart[2]);
        continue;
      }
      const kv = line.match(/^\s+([a-z_]+):\s*(.*)$/);
      if (kv && current) {
        current[kv[1]] = coerceScalar(kv[2]);
      }
    }
  }
  commit();
  return out;
}

function parseVendorJson(src: string, file: string): RegistryEntry {
  const now = Date.now();
  const reg = JSON.parse(src) as Record<string, unknown>;
  const validatedOn = String(reg.validated_on ?? '');
  const ts = Date.parse(validatedOn);
  const ageDays = Number.isFinite(ts) ? Math.floor((now - ts) / 86_400_000) : Infinity;

  const slots: Record<string, unknown[]> = {};
  for (const [key, value] of Object.entries(reg)) {
    if (/_models$/.test(key) && Array.isArray(value)) slots[key] = value;
  }
  // Flat entries list (every model across every slot) so the generic UI
  // path works even for vendor registries.
  const entries: Array<Record<string, unknown>> = [];
  for (const [slotName, models] of Object.entries(slots)) {
    for (const m of models) {
      if (m && typeof m === 'object') {
        entries.push({ slot: slotName, ...(m as Record<string, unknown>) });
      }
    }
  }

  return {
    kind: 'vendor',
    path: `.ai-dev-kit/registries/${file}`,
    last_synced_on: validatedOn || null,
    entries_count: entries.length,
    entries,
    vendor: String(reg.vendor ?? file.replace('.json', '')),
    label: reg.label as string | undefined,
    docs_root: reg.docs_root as string | undefined,
    console_url: reg.console_url as string | undefined,
    validated_on: validatedOn,
    ageDays: Number.isFinite(ageDays) ? ageDays : undefined,
    stale: Number.isFinite(ageDays) ? ageDays > 90 : undefined,
    required_env: (reg.required_env as string[] | undefined) ?? [],
    deprecations: (reg.deprecations as unknown[] | undefined) ?? [],
    slots,
  };
}

export async function GET() {
  const startedAt = Date.now();
  const cwd = process.cwd();
  const dir = join(cwd, '.ai-dev-kit', 'registries');

  if (!existsSync(dir)) {
    logKitEvent({ kind: 'dashboard_api', name: '/api/dev-kit/registries', phase: 'end', outcome: 'empty', duration_ms: Date.now() - startedAt, reason: 'registries directory missing' });
    return NextResponse.json({
      ts: new Date().toISOString(),
      registries: [],
      empty: true,
      reason: 'directory .ai-dev-kit/registries/ does not exist -- run npx ai-dev-kit adopt',
    });
  }

  let fileList: string[];
  try {
    fileList = readdirSync(dir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logKitEvent({ kind: 'dashboard_api', name: '/api/dev-kit/registries', phase: 'end', outcome: 'fail', duration_ms: Date.now() - startedAt, reason: 'registries directory unreadable', error: message.slice(0, 500) });
    return NextResponse.json(
      {
        error: 'registries_unreadable',
        reason: 'could not list .ai-dev-kit/registries/ -- check filesystem permissions',
        detail: message.slice(0, 300),
        endpoint: '/api/dev-kit/registries',
      },
      { status: 500 },
    );
  }

  const yamlFiles = fileList.filter(f => f.endsWith('.yaml'));
  const jsonFiles = fileList.filter(f => f.endsWith('.json') && f !== 'registry.schema.json');

  if (yamlFiles.length === 0 && jsonFiles.length === 0) {
    logKitEvent({ kind: 'dashboard_api', name: '/api/dev-kit/registries', phase: 'end', outcome: 'empty', duration_ms: Date.now() - startedAt, reason: 'no yaml/json files in registries directory' });
    return NextResponse.json({
      ts: new Date().toISOString(),
      registries: [],
      empty: true,
      reason: 'no registry YAML files found at .ai-dev-kit/registries/ -- run `pnpm exec tsx scripts/sync-registries.ts`',
    });
  }

  const registries: RegistryEntry[] = [];

  for (const file of yamlFiles.sort()) {
    const abs = join(dir, file);
    const rel = `.ai-dev-kit/registries/${file}`;
    const fallbackKind = file.replace(/\.yaml$/, '');
    try {
      const src = readFileSync(abs, 'utf-8');
      const parsed = parseSimpleRegistry(src, fallbackKind);
      registries.push({
        kind: parsed.kind,
        path: rel,
        schema_version: parsed.schema_version,
        last_synced_on: parsed.last_synced_on,
        entries_count: parsed.entries.length,
        entries: parsed.entries,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      registries.push({
        kind: fallbackKind,
        path: rel,
        last_synced_on: null,
        entries_count: 0,
        entries: [],
        parse_error: message.slice(0, 300),
      });
    }
  }

  for (const file of jsonFiles.sort()) {
    const abs = join(dir, file);
    const rel = `.ai-dev-kit/registries/${file}`;
    try {
      const src = readFileSync(abs, 'utf-8');
      registries.push(parseVendorJson(src, file));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      registries.push({
        kind: 'vendor',
        path: rel,
        vendor: file.replace(/\.json$/, ''),
        last_synced_on: null,
        entries_count: 0,
        entries: [],
        parse_error: message.slice(0, 300),
      });
    }
  }

  logKitEvent({ kind: 'dashboard_api', name: '/api/dev-kit/registries', phase: 'end', outcome: 'ok', duration_ms: Date.now() - startedAt, meta: { count: registries.length } });
  return NextResponse.json({ ts: new Date().toISOString(), registries });
}
