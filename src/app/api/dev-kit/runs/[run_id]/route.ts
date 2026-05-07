/**
 * GET /api/dev-kit/runs/[run_id] -- single-run aggregate.
 *
 * Joins every run-tagged data source into ONE response so the UI at
 * /dev-kit/runs/[run_id] can render a feature build's full timeline:
 *
 *   - meta              (from .ai-dev-kit/state/runs/history/<id>.json)
 *   - ai_calls          (logAICall records filtered by run_id)
 *   - vendor_calls      (withExternalCall records filtered by run_id)
 *   - docs_lookups      (.ai-dev-kit/state/docs-lookups.jsonl filtered by run_id)
 *   - skill_invocations (.ai-dev-kit/state/skill-invocations.jsonl filtered by run_id)
 *   - tests             (test-results/**\/*.json with matching run_id tag)
 *   - costs             (summed from ai_calls.estimated_cost_usd + vendor_calls.estimated_cost_usd,
 *                        split by cost_source: llm_tokens | vendor_api)
 *   - verifications     (.claude/hooks/state.json verifications slice)
 */
import { NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { logKitEvent } from '@/lib/kit-audit';

const ENDPOINT = '/api/dev-kit/runs/[run_id]';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ run_id: string }> }

function readJsonl(path: string): Array<Record<string, unknown>> {
  if (!existsSync(path)) return [];
  const src = readFileSync(path, 'utf-8');
  const out: Array<Record<string, unknown>> = [];
  for (const line of src.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return out;
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')) as T; } catch { return null; }
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const d = stack.pop()!;
    let entries: string[];
    try { entries = readdirSync(d); } catch { continue; }
    for (const e of entries) {
      const full = join(d, e);
      try {
        const st = statSync(full);
        if (st.isDirectory()) stack.push(full);
        else out.push(full);
      } catch { /* skip */ }
    }
  }
  return out;
}

export async function GET(_req: Request, context: Params) {
  const startedAt = Date.now();
  const { run_id } = await context.params;
  const root = process.cwd();

  const meta = readJson<Record<string, unknown>>(
    join(root, '.ai-dev-kit', 'state', 'runs', 'history', `${run_id}.json`),
  );
  if (!meta) {
    logKitEvent({
      kind: 'dashboard_api',
      name: ENDPOINT,
      phase: 'end',
      outcome: 'empty',
      duration_ms: Date.now() - startedAt,
      reason: `run_id=${run_id} not found in history`,
    });
    return NextResponse.json({ error: 'run not found' }, { status: 404 });
  }

  const logsDir = join(root, '.ai-logs');
  const aiCalls: Array<Record<string, unknown>> = [];
  const vendorCalls: Array<Record<string, unknown>> = [];
  if (existsSync(logsDir)) {
    for (const file of walk(logsDir)) {
      if (!file.endsWith('.json') && !file.endsWith('.jsonl')) continue;
      for (const entry of readJsonl(file)) {
        if (entry.run_id !== run_id) continue;
        const evt = typeof entry.event === 'string' ? entry.event : '';
        if (evt.startsWith('external.')) vendorCalls.push(entry);
        else aiCalls.push(entry);
      }
    }
  }

  const docs = readJsonl(join(root, '.ai-dev-kit', 'state', 'docs-lookups.jsonl'))
    .filter(r => r.run_id === run_id);
  const skills = readJsonl(join(root, '.ai-dev-kit', 'state', 'skill-invocations.jsonl'))
    .filter(r => r.run_id === run_id);

  const testsDir = join(root, 'test-results');
  const tests: Array<Record<string, unknown>> = [];
  if (existsSync(testsDir)) {
    for (const file of walk(testsDir)) {
      if (!file.endsWith('.json')) continue;
      // Two ways to match: explicit run_id field OR filename encodes it
      // (Playwright reporter writes test-results/playwright-<run_id>.json).
      const parsed = readJson<Record<string, unknown>>(file);
      if (!parsed) continue;
      const fileMatches = file.includes(`-${run_id}.json`) || file.includes(`/${run_id}/`);
      if (parsed.run_id === run_id || fileMatches) {
        tests.push({ ...parsed, _source_file: file.slice(root.length + 1) });
      }
    }
  }

  const verifications = readJson<Record<string, unknown>>(join(root, '.claude', 'hooks', 'state.json'));

  const llmCost = aiCalls.reduce((a, r) => a + (typeof r.estimated_cost_usd === 'number' ? r.estimated_cost_usd : 0), 0);
  const vendorCost = vendorCalls.reduce((a, r) => a + (typeof r.estimated_cost_usd === 'number' ? r.estimated_cost_usd : 0), 0);

  logKitEvent({
    kind: 'dashboard_api',
    name: ENDPOINT,
    phase: 'end',
    outcome: 'ok',
    duration_ms: Date.now() - startedAt,
    meta: {
      run_id,
      ai_calls: aiCalls.length,
      vendor_calls: vendorCalls.length,
      tests: tests.length,
    },
  });
  return NextResponse.json({
    meta,
    totals: {
      ai_calls: aiCalls.length,
      vendor_calls: vendorCalls.length,
      docs_lookups: docs.length,
      skill_invocations: skills.length,
      tests: tests.length,
      llm_cost_usd: llmCost,
      vendor_cost_usd: vendorCost,
      total_cost_usd: llmCost + vendorCost,
    },
    ai_calls: aiCalls,
    vendor_calls: vendorCalls,
    docs_lookups: docs,
    skill_invocations: skills,
    tests,
    verifications,
  });
}
