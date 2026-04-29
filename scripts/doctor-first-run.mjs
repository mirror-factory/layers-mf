#!/usr/bin/env node
/**
 * doctor-first-run -- nudge users to run `doctor` once after install.
 *
 * Wired into a scaffolded project's `postinstall` script. It only fires when
 * the project has been initialized by the kit (`.ai-dev-kit.json` exists) and
 * the nudge hasn't already run (`.ai-dev-kit.doctor-ran` absent). Stays quiet
 * in CI to avoid noisy logs on every install.
 *
 * This is intentionally a *nudge*, not a blocker -- a failing postinstall
 * breaks every `pnpm install`, which is worse than stale config.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Quietly no-op in CI or when the kit hasn't been initialized.
if (process.env.CI === 'true') process.exit(0);
if (!existsSync('.ai-dev-kit.json')) process.exit(0);
if (existsSync('.ai-dev-kit.doctor-ran')) process.exit(0);

process.stdout.write('\n  Running ai-dev-kit doctor (first-run health check)...\n');

const result = spawnSync('pnpm', ['exec', 'ai-dev-kit', 'doctor'], { stdio: 'inherit' });

// Always write the marker so we don't re-run on every install, even if doctor
// reported issues -- the user has been shown the output.
try {
  writeFileSync('.ai-dev-kit.doctor-ran', new Date().toISOString() + '\n');
} catch {
  // Non-fatal: can't write marker (e.g. readonly FS). User will see nudge next install.
}

if (result.status !== 0) {
  process.stdout.write('  Doctor reported issues. Run `pnpm dev-kit:doctor` any time to re-check.\n\n');
}

// Never fail the install from here.
process.exit(0);
