#!/usr/bin/env tsx
/**
 * check-tdd -- pre-commit: enforce test-first when `.ai-dev-kit/requirements.yaml`
 * has `tdd: required`.
 *
 * How it works:
 *   1. If `requirements.yaml` doesn't set `tdd: required`, no-op.
 *   2. For each changed source file with a sibling *.test.ts(x):
 *      a. If this commit introduces the test for the first time AND the
 *         implementation for the first time -- require evidence that the
 *         test failed at least once before the implementation was added.
 *      b. Evidence = `.ai-dev-kit/state/tdd-log.jsonl` entry with
 *         {file, test_file, status: "red", ts} BEFORE a matching "green"
 *         entry for the same file in this branch.
 *   3. `.claude/hooks/verify-claims.py` writes "red" / "green" entries
 *      when the agent runs `vitest <test>` and records exit code.
 *
 * Escape hatches:
 *   * `TDD_SKIP=1` (logged as silent regression by audit-rebuild).
 *   * `.ai-dev-kit/tdd-exempt.txt` -- file paths exempt from this check.
 *
 * Policy: opt-in. Greenfield projects turn it on via requirements.yaml.
 * Existing projects ignore the check until they're ready.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const REQ = join(CWD, '.ai-dev-kit', 'requirements.yaml');
const LOG = join(CWD, '.ai-dev-kit', 'state', 'tdd-log.jsonl');
const EXEMPT = join(CWD, '.ai-dev-kit', 'tdd-exempt.txt');

if (process.env.TDD_SKIP === '1') {
  console.log('[check-tdd] TDD_SKIP=1 set; skipping (silent regression).');
  process.exit(0);
}

function tddRequired(): boolean {
  if (!existsSync(REQ)) return false;
  const src = readFileSync(REQ, 'utf-8');
  return /^\s*tdd:\s*required\s*$/m.test(src);
}

if (!tddRequired()) process.exit(0);

function exemptSet(): Set<string> {
  if (!existsSync(EXEMPT)) return new Set();
  return new Set(readFileSync(EXEMPT, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean));
}

function stagedSources(): string[] {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=AM', { cwd: CWD, encoding: 'utf-8' });
    return out.split('\n').filter(Boolean).filter(f => {
      if (!/\.(ts|tsx)$/.test(f)) return false;
      if (/\.test\./.test(f) || /\.spec\./.test(f)) return false;
      if (f.startsWith('scripts/') || f.startsWith('.ai-dev-kit/')) return false;
      return true;
    });
  } catch {
    return [];
  }
}

function testPath(src: string): string {
  return src.replace(/\.(tsx?|jsx?)$/, '.test.$1');
}

function loadLog(): Array<{ file: string; status: 'red' | 'green'; ts: string }> {
  if (!existsSync(LOG)) return [];
  return readFileSync(LOG, 'utf-8').split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

const exempt = exemptSet();
const log = loadLog();
const failures: Array<{ src: string; reason: string }> = [];

for (const src of stagedSources()) {
  if (exempt.has(src)) continue;
  const test = testPath(src);
  if (!existsSync(join(CWD, test))) {
    failures.push({ src, reason: `no sibling test file at ${test}` });
    continue;
  }

  const entries = log.filter(e => e.file === src || e.file === test);
  const firstRed = entries.find(e => e.status === 'red');
  const firstGreen = entries.find(e => e.status === 'green');
  if (!firstRed) {
    failures.push({ src, reason: `no "red" entry in tdd-log.jsonl -- run ${test} before writing ${src}` });
    continue;
  }
  if (firstGreen && firstGreen.ts < firstRed.ts) {
    failures.push({ src, reason: `"green" recorded before "red" -- test never failed` });
  }
}

if (failures.length === 0) process.exit(0);

console.error('\n[check-tdd] BLOCKED: test-first discipline not observed.');
for (const f of failures) {
  console.error(`  ${f.src}  -- ${f.reason}`);
}
console.error('\nFix: run the failing test first (vitest records "red"), then write the implementation, then re-run (records "green").');
console.error('Bypass (not recommended): TDD_SKIP=1 or add the path to .ai-dev-kit/tdd-exempt.txt\n');
process.exit(1);
