/**
 * GET /api/dev-kit/status -- full observability wiring snapshot.
 *
 * Answers the "is everything tracked and connected?" question in one JSON
 * payload. Runs cheap filesystem + env checks; never hits billable APIs.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';
import { withRoute } from '@/lib/with-route';
import { configuredSinks } from '@/lib/log-aggregator';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/status';

interface SinkStatus { sink: string; configured: boolean; note?: string }
interface RegistryStatus { vendor: string; validated_on: string; ageDays: number; modelCount: number; stale: boolean }
interface CoverageStatus { withRoute: number; withRouteTotal: number; withExternalCall: number; withExternalCallTotal: number; withTelemetry: number; withTelemetryTotal: number }
interface RunResultStatus { kind: 'test' | 'eval' | 'compliance'; present: boolean; updatedAt?: string; path?: string }

const MAX_REGISTRY_AGE_DAYS = 90;
const IGNORE_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build']);

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some(e => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function stripComments(src: string) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function coverage(cwd: string): CoverageStatus {
  const libFiles = walk(join(cwd, 'lib'), ['.ts', '.tsx']);
  const appFiles = walk(join(cwd, 'app'), ['.ts', '.tsx']);
  const all = [...libFiles, ...appFiles];

  // withRoute: scanned in files under app/api that export GET/POST/etc.
  const routeFiles = all.filter(f => /\bapp\/api\b/.test(f) && /route\.tsx?$/.test(f));
  const routeWrapped = routeFiles.filter(f => /withRoute\s*\(/.test(stripComments(readFileSync(f, 'utf-8'))));

  // withExternalCall: files that import a vendor SDK
  const vendorRe = /from\s+['"`](?:assemblyai|@deepgram\/sdk|@anthropic-ai\/sdk|openai|@mendable\/firecrawl-js|resend|stripe)['"`]/;
  const vendorFiles = all.filter(f => vendorRe.test(stripComments(readFileSync(f, 'utf-8'))));
  const vendorWrapped = vendorFiles.filter(f => /withExternalCall\s*\(/.test(stripComments(readFileSync(f, 'utf-8'))));

  // withTelemetry: files that call AI SDK
  const aiRe = /\b(?:streamText|generateText|generateObject|streamObject)\s*\(/;
  const aiFiles = all.filter(f => aiRe.test(stripComments(readFileSync(f, 'utf-8'))));
  const aiWrapped = aiFiles.filter(f =>
    /withTelemetry\s*\(|aiCall\s*\(|experimental_telemetry\s*:/.test(stripComments(readFileSync(f, 'utf-8'))),
  );

  return {
    withRoute: routeWrapped.length,
    withRouteTotal: routeFiles.length,
    withExternalCall: vendorWrapped.length,
    withExternalCallTotal: vendorFiles.length,
    withTelemetry: aiWrapped.length,
    withTelemetryTotal: aiFiles.length,
  };
}

function registries(cwd: string): RegistryStatus[] {
  const dir = join(cwd, '.ai-dev-kit/registries');
  if (!existsSync(dir)) return [];
  const now = Date.now();
  const out: RegistryStatus[] = [];
  for (const file of readdirSync(dir)) {
    if (file.endsWith('.yaml')) {
      try {
        const src = readFileSync(join(dir, file), 'utf-8');
        const kind = src.match(/^kind:\s*(.+)$/m)?.[1]?.trim() ?? file.replace('.yaml', '');
        const synced = src.match(/^last_synced_on:\s*(.+)$/m)?.[1]?.trim() ?? '';
        const validated = synced === 'null' ? '' : synced.replace(/^["']|["']$/g, '');
        const ts = Date.parse(validated);
        const ageDays = Number.isFinite(ts) ? Math.floor((now - ts) / 86_400_000) : Infinity;
        out.push({
          vendor: kind,
          validated_on: validated,
          ageDays: Number.isFinite(ageDays) ? ageDays : 0,
          modelCount: (src.match(/^\s+-\s+/gm) ?? []).length,
          stale: Number.isFinite(ageDays) ? ageDays > MAX_REGISTRY_AGE_DAYS : false,
        });
      } catch { /* skip malformed */ }
      continue;
    }
    if (!file.endsWith('.json') || file === 'registry.schema.json') continue;
    try {
      const reg = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as {
        vendor?: string; validated_on?: string; [k: string]: unknown;
      };
      const validated = reg.validated_on ?? '';
      const ts = Date.parse(validated);
      const ageDays = Number.isFinite(ts) ? Math.floor((now - ts) / 86_400_000) : Infinity;
      const modelCount = Object.entries(reg).reduce((n, [k, v]) =>
        /_models$/.test(k) && Array.isArray(v) ? n + (v as unknown[]).length : n, 0);
      out.push({
        vendor: reg.vendor ?? file.replace('.json', ''),
        validated_on: validated,
        ageDays,
        modelCount,
        stale: ageDays > MAX_REGISTRY_AGE_DAYS,
      });
    } catch { /* skip malformed */ }
  }
  return out;
}

function runResults(cwd: string): RunResultStatus[] {
  function check(kind: RunResultStatus['kind'], candidates: string[]): RunResultStatus {
    for (const p of candidates) {
      const full = join(cwd, p);
      if (existsSync(full)) {
        return { kind, present: true, path: p, updatedAt: statSync(full).mtime.toISOString() };
      }
    }
    return { kind, present: false };
  }
  return [
    check('test', ['test-results/unit.json', '.test-results/unit.json', '.ai-logs']),
    check('eval', ['.test-results/eval-results.json', 'test-results/eval-results.json']),
    check('compliance', ['.evidence/summary.json', '.evidence/gates/summary.json', '.test-results/compliance.json']),
  ];
}

export const GET = withRoute(async () => {
  const startedAt = Date.now();
  const cwd = process.cwd();

  const sinkMap = configuredSinks(cwd);
  const sinks: SinkStatus[] = Object.entries(sinkMap).map(([sink, configured]) => ({
    sink,
    configured: Boolean(configured),
    note: !configured && sink === 'langfuse'
      ? 'Set LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY in .env.local'
      : !configured && sink === 'supabase'
      ? 'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'
      : !configured && sink === 'dev3000'
      ? 'Optional: `bun install -g dev3000` + `d3k --with-agent claude`'
      : undefined,
  }));

  const warnings: string[] = [];
  if (!sinkMap.langfuse && !sinkMap.supabase && !sinkMap.file) {
    warnings.push('No persistent sink configured. Logs will not survive a process restart.');
  }

  const cov = coverage(cwd);
  if (cov.withRoute < cov.withRouteTotal) warnings.push(`${cov.withRouteTotal - cov.withRoute} API routes without withRoute()`);
  if (cov.withExternalCall < cov.withExternalCallTotal) warnings.push(`${cov.withExternalCallTotal - cov.withExternalCall} vendor-SDK files without withExternalCall()`);
  if (cov.withTelemetry < cov.withTelemetryTotal) warnings.push(`${cov.withTelemetryTotal - cov.withTelemetry} AI-SDK files without withTelemetry() / aiCall()`);

  const regs = registries(cwd);
  for (const r of regs) if (r.stale) warnings.push(`${r.vendor} registry is ${r.ageDays} days stale (>${MAX_REGISTRY_AGE_DAYS} max)`);

  const results = runResults(cwd);
  const missingRequiredResults = results.filter(
    result => (result.kind === 'test' || result.kind === 'compliance') && !result.present,
  );
  for (const result of missingRequiredResults) {
    warnings.push(`${result.kind} evidence is missing`);
  }

  const overall = warnings.length === 0 ? 'ok' : warnings.length < 3 ? 'degraded' : 'critical';
  logKitEvent({
    kind: 'dashboard_api',
    name: ENDPOINT,
    phase: 'end',
    outcome: overall === 'ok' ? 'ok' : 'warn',
    duration_ms: Date.now() - startedAt,
    meta: { overall, warnings: warnings.length },
  });
  return NextResponse.json({
    ts: new Date().toISOString(),
    sinks,
    registries: regs,
    coverage: cov,
    runResults: results,
    warnings,
    overall,
  });
});
