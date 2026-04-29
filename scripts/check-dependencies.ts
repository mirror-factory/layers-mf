#!/usr/bin/env tsx
/**
 * check-dependencies -- pre-push.
 *
 * Reads .ai-dev-kit/registries/dependencies.yaml. Fails on any
 * CRITICAL or HIGH. Warns on MEDIUM. Also fails if last_audited_on
 * is older than 14 days (stale audit = false confidence).
 *
 * Bypass: DEPS_SKIP=1 (logged by audit-rebuild as silent regression).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const REG = join(CWD, '.ai-dev-kit', 'registries', 'dependencies.yaml');
const STALE_DAYS = 14;

if (process.env.DEPS_SKIP === '1') {
  console.log('[check-dependencies] DEPS_SKIP=1 set; skipping (silent regression).');
  process.exit(0);
}

if (!existsSync(REG)) {
  console.log('[check-dependencies] dependencies.yaml missing; run sync-dependencies.ts first. Skipping.');
  process.exit(0);
}

const src = readFileSync(REG, 'utf-8');

const auditMatch = src.match(/^last_audited_on:\s*"?(.+?)"?$/m);
if (auditMatch) {
  const age = (Date.now() - Date.parse(auditMatch[1])) / 86400_000;
  if (age > STALE_DAYS) {
    console.error(`[check-dependencies] FAIL: audit is ${Math.round(age)} days old (>${STALE_DAYS}).`);
    console.error('  Fix: pnpm exec tsx scripts/sync-dependencies.ts, commit dependencies.yaml, push.');
    process.exit(1);
  }
}

const critMatch = src.match(/^\s+critical:\s*(\d+)/m);
const highMatch = src.match(/^\s+high:\s*(\d+)/m);
const medMatch  = src.match(/^\s+medium:\s*(\d+)/m);
const crit = critMatch ? Number(critMatch[1]) : 0;
const high = highMatch ? Number(highMatch[1]) : 0;
const med  = medMatch  ? Number(medMatch[1])  : 0;

if (crit > 0 || high > 0) {
  console.error(`[check-dependencies] BLOCKED: ${crit} CRITICAL + ${high} HIGH vulnerabilities.`);
  console.error('');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/severity:\s*(CRITICAL|HIGH)/.test(lines[i])) {
      const before = lines.slice(Math.max(0, i - 8), i + 1).reverse().find(l => /^\s+-\s+name:/.test(l));
      if (before) console.error('  ' + before.trim() + '  ' + (lines[i].match(/severity:\s*(\w+)/) || ['', '?'])[1]);
    }
  }
  console.error('');
  console.error('Fix: upgrade the affected packages, or add to pnpm overrides.');
  console.error('Bypass (logged as silent regression): DEPS_SKIP=1');
  process.exit(1);
}
if (med > 0) {
  console.warn(`[check-dependencies] WARN: ${med} MEDIUM vulnerabilities (not blocking).`);
}
console.log(`[check-dependencies] OK: no CRITICAL or HIGH.`);
process.exit(0);
