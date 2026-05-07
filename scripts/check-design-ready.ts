#!/usr/bin/env tsx
/**
 * check-design-ready -- pre-commit gate that blocks UI changes when the
 * design system isn't populated.
 *
 * Reality check: without this, a new project can create
 * components/Button.tsx on day one without ever running `ai-dev-kit
 * design`. `check-brand-tokens` passes silently (empty tokens = no-op),
 * and drift is born. The whole point of "design-first" evaporates.
 *
 * Policy:
 *   * If any staged file is under components/**, app/**.tsx, or
 *     src/components/** AND design-tokens.yaml is effectively empty
 *     (no colors / typography / spacing declared), BLOCK.
 *   * API-only changes (no UI) pass through -- not every project has
 *     a frontend.
 *   * Bypass: DESIGN_SKIP=1 (logged by audit-rebuild as silent regression).
 *
 * Enforced on: pre-commit. Runs BEFORE check-brand-tokens so the
 * agent gets the design-first instruction first.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const TOKENS_PATH = join(CWD, '.ai-dev-kit', 'registries', 'design-tokens.yaml');

if (process.env.DESIGN_SKIP === '1') {
  console.log('[check-design-ready] DESIGN_SKIP=1 set; skipping (silent regression).');
  process.exit(0);
}

function tokensEmpty(): boolean {
  if (!existsSync(TOKENS_PATH)) return true;
  const src = readFileSync(TOKENS_PATH, 'utf-8');
  // Look for any uncommented `key: value` line under colors/typography/spacing.
  let inSection = false;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    if (/^(colors|typography|spacing):\s*$/.test(line)) { inSection = true; continue; }
    if (/^[a-z_]+:/.test(line) && !/^(colors|typography|spacing):/.test(line)) { inSection = false; }
    if (!inSection) continue;
    if (/^\s+[a-z0-9.]+:\s*["'#a-zA-Z0-9]/.test(line) && !line.trim().startsWith('#')) return false;
  }
  return true;
}

function stagedUIFiles(): string[] {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', { cwd: CWD, encoding: 'utf-8' });
    return out.split('\n').filter(f => {
      if (!f) return false;
      // UI file: components/** OR src/components/** OR app/**/page.tsx OR app/**/layout.tsx
      return (
        f.startsWith('components/') ||
        f.startsWith('src/components/') ||
        /^app\/.+\.(tsx|jsx)$/.test(f) ||
        /^src\/app\/.+\.(tsx|jsx)$/.test(f)
      ) && !f.endsWith('.stories.tsx') && !f.endsWith('.test.tsx') && !f.endsWith('.spec.tsx');
    });
  } catch {
    return [];
  }
}

const ui = stagedUIFiles();
if (ui.length === 0) process.exit(0);

if (!tokensEmpty()) process.exit(0);

console.error('\n[check-design-ready] BLOCKED: UI changes staged but no design tokens declared.');
console.error('');
console.error('Staged UI files:');
for (const f of ui.slice(0, 10)) console.error('  ' + f);
if (ui.length > 10) console.error(`  ... +${ui.length - 10} more`);
console.error('');
console.error('`.ai-dev-kit/registries/design-tokens.yaml` has no colors / typography / spacing');
console.error('entries. Design-first is the kit\'s contract: tokens exist BEFORE the .tsx.');
console.error('');
console.error('Fix (pick one):');
console.error('  1. `ai-dev-kit design <feature>` -- invoke @design-agent to propose tokens + system spec');
console.error('  2. `ai-dev-kit design <feature> --auto` -- headless: aiCall generates outputs');
console.error('  3. Hand-edit `.ai-dev-kit/registries/design-tokens.yaml` + touch');
console.error('     `features/<name>/DESIGN-READY.md`');
console.error('');
console.error('Bypass (not recommended; logged as silent regression):');
console.error('  DESIGN_SKIP=1 git commit ...');
console.error('');
process.exit(1);
