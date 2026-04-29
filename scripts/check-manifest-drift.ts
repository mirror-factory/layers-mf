#!/usr/bin/env tsx
/**
 * check-manifest-drift -- pre-push.
 *
 * For every features/<name>/TEST-MANIFEST.yaml, regenerate the Expect
 * + Playwright files into memory and compare byte-for-byte with the
 * committed versions at tests/expect/<name>.expect.ts and
 * tests/e2e/<name>.spec.ts. Any drift fails the push.
 *
 * Fix: ai-dev-kit manifest generate <feature> (then commit).
 *
 * Bypass: MANIFEST_SKIP=1.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CWD = process.cwd();

if (process.env.MANIFEST_SKIP === '1') {
  console.log('[check-manifest-drift] MANIFEST_SKIP=1 set; skipping (silent regression).');
  process.exit(0);
}

function listFeatures(): string[] {
  const dir = join(CWD, 'features');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(name => {
    if (name.startsWith('_')) return false;
    try {
      return statSync(join(dir, name)).isDirectory() &&
        existsSync(join(dir, name, 'TEST-MANIFEST.yaml'));
    } catch { return false; }
  });
}

const drifted: string[] = [];

for (const feature of listFeatures()) {
  const expectCommitted = join(CWD, 'tests', 'expect', `${feature}.expect.ts`);
  const playwrightCommitted = join(CWD, 'tests', 'e2e', `${feature}.spec.ts`);

  const tmp = mkdtempSync(join(tmpdir(), `mfdrift-${feature}-`));
  try {
    try {
      execSync(`npx tsx scripts/generate-expect-from-manifest.ts ${feature}`, { cwd: CWD, stdio: 'pipe', env: { ...process.env, MANIFEST_OUT_DIR: tmp } });
      execSync(`npx tsx scripts/generate-playwright-from-manifest.ts ${feature}`, { cwd: CWD, stdio: 'pipe', env: { ...process.env, MANIFEST_OUT_DIR: tmp } });
    } catch (err) {
      console.warn(`[check-manifest-drift] generator failed for ${feature}: ${(err as Error).message}`);
      drifted.push(`${feature} (generator error)`);
      continue;
    }

    const newExpect = existsSync(join(tmp, 'expect', `${feature}.expect.ts`))
      ? readFileSync(join(tmp, 'expect', `${feature}.expect.ts`), 'utf-8')
      : null;
    const newPlaywright = existsSync(join(tmp, 'e2e', `${feature}.spec.ts`))
      ? readFileSync(join(tmp, 'e2e', `${feature}.spec.ts`), 'utf-8')
      : null;

    const committedExpect = existsSync(expectCommitted) ? readFileSync(expectCommitted, 'utf-8') : '';
    const committedPlaywright = existsSync(playwrightCommitted) ? readFileSync(playwrightCommitted, 'utf-8') : '';

    if (newExpect && newExpect !== committedExpect) drifted.push(`${feature} (expect)`);
    if (newPlaywright && newPlaywright !== committedPlaywright) drifted.push(`${feature} (playwright)`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (drifted.length === 0) {
  console.log('[check-manifest-drift] OK: all generated tests match committed files.');
  process.exit(0);
}

console.error('\n[check-manifest-drift] BLOCKED: generated tests differ from committed.');
console.error('');
for (const d of drifted) console.error(`  ${d}`);
console.error('');
console.error('Fix: ai-dev-kit manifest generate <feature>, then commit the regenerated test files.');
console.error('Bypass (logged as silent regression): MANIFEST_SKIP=1');
console.error('');
process.exit(1);
