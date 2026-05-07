#!/usr/bin/env tsx
/**
 * check-test-manifest-coverage -- pre-commit.
 *
 * For every features/<name>/SPEC.md with a `## Acceptance` section of
 * `- [ ]` checkboxes, verify the matching TEST-MANIFEST.yaml has flows
 * or steps that reference each acceptance item. Loose match: any flow
 * name or step that contains meaningful keywords from the checkbox text.
 *
 * Bypass: MANIFEST_SKIP=1 (logged as silent regression by audit-rebuild).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();

if (process.env.MANIFEST_SKIP === '1') {
  console.log('[check-test-manifest-coverage] MANIFEST_SKIP=1 set; skipping (silent regression).');
  process.exit(0);
}

function listFeatures(): string[] {
  const dir = join(CWD, 'features');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => !name.startsWith('_'))
    .filter(name => {
      try { return statSync(join(dir, name)).isDirectory(); } catch { return false; }
    });
}

function parseAcceptance(specPath: string): string[] {
  if (!existsSync(specPath)) return [];
  const src = readFileSync(specPath, 'utf-8');
  const lines: string[] = [];
  let inAcceptance = false;
  for (const raw of src.split('\n')) {
    if (/^##\s+Acceptance/i.test(raw)) { inAcceptance = true; continue; }
    if (/^##\s+/.test(raw) && !/^##\s+Acceptance/i.test(raw)) { inAcceptance = false; continue; }
    if (!inAcceptance) continue;
    const m = raw.match(/^\s*-\s*\[\s*[ xX]\s*\]\s*(.+)$/);
    if (m) lines.push(m[1].trim());
  }
  return lines;
}

function tokenize(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3);
}

function manifestText(path: string): string {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8').toLowerCase();
}

const failures: Array<{ feature: string; missing: string[] }> = [];

for (const feature of listFeatures()) {
  const spec = join(CWD, 'features', feature, 'SPEC.md');
  const manifest = join(CWD, 'features', feature, 'TEST-MANIFEST.yaml');
  const acceptance = parseAcceptance(spec);
  if (acceptance.length === 0) continue;
  if (!existsSync(manifest)) {
    failures.push({ feature, missing: [`TEST-MANIFEST.yaml missing (${acceptance.length} acceptance items unmapped)`] });
    continue;
  }
  const mf = manifestText(manifest);
  const missing: string[] = [];
  for (const item of acceptance) {
    if (item.toLowerCase().includes('design approved')) continue;
    const tokens = tokenize(item);
    if (tokens.length === 0) continue;
    const hitCount = tokens.filter(t => mf.includes(t)).length;
    if (hitCount / tokens.length < 0.5) missing.push(item);
  }
  if (missing.length > 0) failures.push({ feature, missing });
}

if (failures.length === 0) process.exit(0);

console.error('\n[check-test-manifest-coverage] BLOCKED: SPEC acceptance items missing manifest coverage.');
console.error('');
for (const f of failures) {
  console.error(`features/${f.feature}:`);
  for (const m of f.missing.slice(0, 5)) console.error(`  - ${m}`);
  if (f.missing.length > 5) console.error(`  ... +${f.missing.length - 5} more`);
}
console.error('');
console.error('Fix: add flows or steps to TEST-MANIFEST.yaml that cover each acceptance item.');
console.error('Bypass (logged as silent regression): MANIFEST_SKIP=1');
console.error('');
process.exit(1);
