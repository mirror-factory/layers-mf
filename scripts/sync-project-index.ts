#!/usr/bin/env tsx
/**
 * sync-project-index -- regenerate .ai-dev-kit/registries/index.yaml from
 * every other registry + features + 30d log aggregation. Runs pre-commit.
 *
 * This is the "registry of registries" -- the top-level map the agent
 * sees at SessionStart via the compressed block in AGENTS.md.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CWD = process.cwd();
const OUT = join(CWD, '.ai-dev-kit', 'registries', 'index.yaml');

type Status = 'drafting' | 'designing' | 'building' | 'shipped';

interface Feature {
  name: string;
  status: Status;
  spec: string;
  design_ready: boolean;
  test_manifest: string | null;
  flows: number;
  routes: string[];
  components: string[];
  api_routes: string[];
  vendors: string[];
  last_run: string | null;
  last_run_status: string | null;
}

function listFeatures(): string[] {
  const dir = join(CWD, 'features');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(name => {
    if (name.startsWith('_')) return false;
    try { return statSync(join(dir, name)).isDirectory(); } catch { return false; }
  });
}

function inferStatus(feature: string): Status {
  const dir = join(CWD, 'features', feature);
  const hasSpec = existsSync(join(dir, 'SPEC.md'));
  const hasDesignReady = existsSync(join(dir, 'DESIGN-READY.md'));
  const hasManifest = existsSync(join(dir, 'TEST-MANIFEST.yaml'));
  const hasWireframes = existsSync(join(dir, 'wireframes')) && readdirSync(join(dir, 'wireframes')).length > 0;
  if (!hasSpec) return 'drafting';
  if (!hasDesignReady) return hasWireframes ? 'designing' : 'drafting';
  // has DESIGN-READY. If no runs history for it, call it building.
  return lookupLastRun(feature) ? 'shipped' : 'building';
}

function lookupLastRun(feature: string): { run_id: string; status: string } | null {
  const hist = join(CWD, '.ai-dev-kit', 'state', 'runs', 'history');
  if (!existsSync(hist)) return null;
  const files = readdirSync(hist).filter(f => f.endsWith('.json'));
  let best: { run_id: string; status: string; ts: string } | null = null;
  for (const f of files) {
    try {
      const parsed = JSON.parse(readFileSync(join(hist, f), 'utf-8'));
      if (parsed.feature_name !== feature) continue;
      const ts = parsed.started_at || '';
      if (!best || ts > best.ts) {
        best = { run_id: parsed.run_id, status: parsed.status || 'unknown', ts };
      }
    } catch { /* skip */ }
  }
  return best ? { run_id: best.run_id, status: best.status } : null;
}

function countRegistry(name: string): number | string {
  const path = join(CWD, '.ai-dev-kit', 'registries', `${name}.yaml`);
  if (!existsSync(path)) return 0;
  const src = readFileSync(path, 'utf-8');
  const matches = src.match(/^\s+-\s/gm);
  return matches ? matches.length : 0;
}

function readRegistryLastSync(name: string): string | null {
  const path = join(CWD, '.ai-dev-kit', 'registries', `${name}.yaml`);
  if (!existsSync(path)) return null;
  const m = readFileSync(path, 'utf-8').match(/^last_synced_on:\s*(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

function readProjectName(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(CWD, 'package.json'), 'utf-8'));
    return pkg.name ?? 'unknown';
  } catch { return 'unknown'; }
}

function readStack(): string[] {
  try {
    const pkg = JSON.parse(readFileSync(join(CWD, 'package.json'), 'utf-8'));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const stack: string[] = [];
    if (deps.next) stack.push(`next-${(deps.next as string).replace(/[^0-9.]/g, '').split('.')[0] || 'x'}`);
    if (deps.ai) stack.push('ai-sdk-v6');
    if (deps['@supabase/supabase-js']) stack.push('supabase');
    if (deps.langfuse) stack.push('langfuse');
    if (deps['@playwright/test']) stack.push('playwright');
    if (deps['@anthropic-ai/expect']) stack.push('expect');
    return stack;
  } catch { return []; }
}

function computeTotals30d(): { ai_calls: number; vendor_calls: number; cost_usd: number; tests_run: number; skill_invocations: number } {
  const out = { ai_calls: 0, vendor_calls: 0, cost_usd: 0, tests_run: 0, skill_invocations: 0 };
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
  const logsDir = join(CWD, '.ai-logs');
  if (existsSync(logsDir)) {
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const full = join(d, f);
        try {
          if (statSync(full).isDirectory()) { walk(full); continue; }
          if (!/\.jsonl?$/.test(f)) continue;
          for (const line of readFileSync(full, 'utf-8').split('\n')) {
            if (!line.trim()) continue;
            try {
              const r = JSON.parse(line);
              if ((r.ts || '') < cutoff) continue;
              const evt = typeof r.event === 'string' ? r.event : '';
              if (evt.startsWith('external.')) out.vendor_calls++;
              else out.ai_calls++;
              if (typeof r.estimated_cost_usd === 'number') out.cost_usd += r.estimated_cost_usd;
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
    };
    walk(logsDir);
  }

  const skills = join(CWD, '.ai-dev-kit', 'state', 'skill-invocations.jsonl');
  if (existsSync(skills)) {
    for (const line of readFileSync(skills, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try { if ((JSON.parse(line).ts || '') >= cutoff) out.skill_invocations++; } catch { /* skip */ }
    }
  }

  out.cost_usd = Math.round(out.cost_usd * 100) / 100;
  return out;
}

const features: Feature[] = [];
for (const name of listFeatures()) {
  const dir = join(CWD, 'features', name);
  const manifestPath = join(dir, 'TEST-MANIFEST.yaml');
  const lastRun = lookupLastRun(name);
  const manifestSrc = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf-8') : '';
  const flowCount = (manifestSrc.match(/^\s+-\s+name:\s/gm) || []).length;
  features.push({
    name,
    status: inferStatus(name),
    spec: `features/${name}/SPEC.md`,
    design_ready: existsSync(join(dir, 'DESIGN-READY.md')),
    test_manifest: existsSync(manifestPath) ? `features/${name}/TEST-MANIFEST.yaml` : null,
    flows: flowCount,
    routes: [],
    components: [],
    api_routes: [],
    vendors: [],
    last_run: lastRun?.run_id ?? null,
    last_run_status: lastRun?.status ?? null,
  });
}

const regs = ['components', 'pages', 'tools', 'skills', 'design-tokens', 'design-system', 'test-contracts', 'dependencies'];

const totals = computeTotals30d();

const lines: string[] = [];
lines.push('kind: project-index');
lines.push('schema_version: 1');
lines.push(`last_synced_on: "${new Date().toISOString()}"`);
lines.push('');
lines.push('project:');
lines.push(`  name: ${readProjectName()}`);
lines.push(`  stack: [${readStack().join(', ')}]`);
lines.push('  spec_path: .ai-dev-kit/spec.md');
lines.push('');
lines.push(features.length === 0 ? 'features: []' : 'features:');
for (const f of features) {
  lines.push(`  - name: ${f.name}`);
  lines.push(`    status: ${f.status}`);
  lines.push(`    spec: ${f.spec}`);
  lines.push(`    design_ready: ${f.design_ready}`);
  lines.push(`    test_manifest: ${f.test_manifest ?? 'null'}`);
  lines.push(`    flows: ${f.flows}`);
  lines.push(`    last_run: ${f.last_run ?? 'null'}`);
  lines.push(`    last_run_status: ${f.last_run_status ?? 'null'}`);
}
lines.push('');
lines.push('registries:');
for (const r of regs) {
  lines.push(`  - path: .ai-dev-kit/registries/${r}.yaml`);
  lines.push(`    entries: ${countRegistry(r)}`);
  lines.push(`    last_synced_on: ${readRegistryLastSync(r) ?? 'null'}`);
}
lines.push('');
lines.push('totals_30d:');
lines.push(`  ai_calls: ${totals.ai_calls}`);
lines.push(`  vendor_calls: ${totals.vendor_calls}`);
lines.push(`  cost_usd: ${totals.cost_usd}`);
lines.push(`  tests_run: ${totals.tests_run}`);
lines.push(`  skill_invocations: ${totals.skill_invocations}`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`[sync-project-index] ${features.length} features, ${regs.length} registries -> ${OUT.replace(CWD + '/', '')}`);
