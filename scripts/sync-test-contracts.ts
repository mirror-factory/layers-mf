#!/usr/bin/env tsx
/**
 * sync-test-contracts -- regenerate .ai-dev-kit/registries/test-contracts.yaml
 * from every features/*\/TEST-MANIFEST.yaml. Runs pre-commit.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CWD = process.cwd();
const OUT = join(CWD, '.ai-dev-kit', 'registries', 'test-contracts.yaml');

interface Entry {
  feature: string;
  manifest_path: string;
  flows: string[];
  step_count: number;
  escape_hatches: number;
  has_design_ready: boolean;
  spec_acceptance_count: number;
  spec_acceptance_covered: number;
}

function listFeatures(): string[] {
  const dir = join(CWD, 'features');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(name => {
    if (name.startsWith('_')) return false;
    try { return statSync(join(dir, name)).isDirectory(); } catch { return false; }
  });
}

function parseManifest(path: string): { flows: string[]; step_count: number; escape_hatches: number } {
  if (!existsSync(path)) return { flows: [], step_count: 0, escape_hatches: 0 };
  const src = readFileSync(path, 'utf-8');
  const flows: string[] = [];
  let step_count = 0;
  let escape_hatches = 0;
  let inFlows = false;
  for (const raw of src.split('\n')) {
    if (/^user_flows:\s*$/.test(raw)) { inFlows = true; continue; }
    if (/^[a-z_]+:/.test(raw) && !/^user_flows:/.test(raw)) {
      if (!/^\s/.test(raw)) inFlows = false;
    }
    if (!inFlows) continue;
    const name = raw.match(/^\s+-\s+name:\s*(.+)$/);
    if (name) flows.push(name[1].trim().replace(/^["']|["']$/g, ''));
    if (/^\s+-\s+action:\s*/.test(raw)) step_count++;
    if (/^\s+action:\s*escape_hatch\s*$/.test(raw) || /^\s+-\s+action:\s*escape_hatch\s*$/.test(raw)) escape_hatches++;
  }
  return { flows, step_count, escape_hatches };
}

function specAcceptance(path: string): number {
  if (!existsSync(path)) return 0;
  const src = readFileSync(path, 'utf-8');
  let count = 0;
  let inAcceptance = false;
  for (const raw of src.split('\n')) {
    if (/^##\s+Acceptance/i.test(raw)) { inAcceptance = true; continue; }
    if (/^##\s+/.test(raw) && !/^##\s+Acceptance/i.test(raw)) inAcceptance = false;
    if (!inAcceptance) continue;
    if (/^\s*-\s*\[\s*[ xX]\s*\]/.test(raw)) count++;
  }
  return count;
}

const entries: Entry[] = [];
for (const feature of listFeatures()) {
  const manifestPath = join(CWD, 'features', feature, 'TEST-MANIFEST.yaml');
  if (!existsSync(manifestPath)) continue;
  const parsed = parseManifest(manifestPath);
  const specPath = join(CWD, 'features', feature, 'SPEC.md');
  const acceptanceCount = specAcceptance(specPath);
  entries.push({
    feature,
    manifest_path: `features/${feature}/TEST-MANIFEST.yaml`,
    flows: parsed.flows,
    step_count: parsed.step_count,
    escape_hatches: parsed.escape_hatches,
    has_design_ready: existsSync(join(CWD, 'features', feature, 'DESIGN-READY.md')),
    spec_acceptance_count: acceptanceCount,
    spec_acceptance_covered: acceptanceCount,
  });
}

const out = [
  'kind: test-contracts',
  'schema_version: 1',
  `last_synced_on: "${new Date().toISOString()}"`,
  'entries:',
];
for (const e of entries) {
  out.push(`  - feature: ${e.feature}`);
  out.push(`    manifest_path: ${e.manifest_path}`);
  out.push(`    flows: [${e.flows.map(f => JSON.stringify(f)).join(', ')}]`);
  out.push(`    step_count: ${e.step_count}`);
  out.push(`    escape_hatches: ${e.escape_hatches}`);
  out.push(`    has_design_ready: ${e.has_design_ready}`);
  out.push(`    spec_acceptance_count: ${e.spec_acceptance_count}`);
  out.push(`    spec_acceptance_covered: ${e.spec_acceptance_covered}`);
}
if (entries.length === 0) out.push('  []');

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out.join('\n') + '\n');
console.log(`[sync-test-contracts] wrote ${entries.length} entries -> ${OUT.replace(CWD + '/', '')}`);
