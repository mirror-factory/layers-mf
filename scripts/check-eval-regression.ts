#!/usr/bin/env tsx
/**
 * check-eval-regression -- compare promptfoo pass-rate to the last committed
 * baseline. Fails pre-push when pass rate drops >= REGRESSION_THRESHOLD.
 *
 * Baseline: `.ai-dev-kit/state/eval-baseline.json` with
 *   { pass_rate: 0.92, per_assertion: { name: pass_rate }, recorded_on: "..." }
 *
 * On first run the baseline is seeded from the current result and the check
 * passes. Subsequent runs compare. To intentionally update the baseline
 * (e.g. after a deliberate prompt change that trades a worse case for a
 * better one), set `EVAL_BASELINE_UPDATE=1`.
 *
 * Exit codes:
 *   0 = pass (or first run baseline seeded)
 *   1 = regression (current pass rate < baseline - threshold)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CWD = process.cwd();
const RESULTS = join(CWD, '.test-results', 'eval-results.json');
const BASELINE = join(CWD, '.ai-dev-kit', 'state', 'eval-baseline.json');
const REGRESSION_THRESHOLD = 0.03; // 3 pts drop triggers fail

interface PromptfooResult {
  results?: Array<{ success: boolean; testCase?: { description?: string } }>;
  stats?: { successes?: number; failures?: number };
  assertions?: Array<{ type?: string; pass?: boolean }>;
}

function loadResults(): PromptfooResult | null {
  if (!existsSync(RESULTS)) return null;
  try { return JSON.parse(readFileSync(RESULTS, 'utf-8')); } catch { return null; }
}

function loadBaseline(): { pass_rate: number; recorded_on: string } | null {
  if (!existsSync(BASELINE)) return null;
  try { return JSON.parse(readFileSync(BASELINE, 'utf-8')); } catch { return null; }
}

function saveBaseline(pass_rate: number): void {
  mkdirSync(dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, JSON.stringify({ pass_rate, recorded_on: new Date().toISOString() }, null, 2));
}

function computePassRate(r: PromptfooResult): number | null {
  if (r.stats && typeof r.stats.successes === 'number' && typeof r.stats.failures === 'number') {
    const total = r.stats.successes + r.stats.failures;
    return total > 0 ? r.stats.successes / total : null;
  }
  if (Array.isArray(r.results) && r.results.length > 0) {
    const passed = r.results.filter(x => x.success).length;
    return passed / r.results.length;
  }
  return null;
}

async function notifyBlocker(title: string, body: string): Promise<void> {
  try {
    const mod = await import(join(CWD, 'lib', 'notify.ts'));
    await mod.notify({ kind: 'blocker', title, body });
  } catch { /* silent */ }
}

async function main(): Promise<number> {
  const results = loadResults();
  if (!results) {
    console.log('[check-eval-regression] no promptfoo results yet; skipping.');
    return 0;
  }

  const current = computePassRate(results);
  if (current == null) {
    console.log('[check-eval-regression] could not compute pass rate; skipping.');
    return 0;
  }

  if (process.env.EVAL_BASELINE_UPDATE === '1') {
    saveBaseline(current);
    console.log(`[check-eval-regression] baseline updated: ${(current * 100).toFixed(1)}%`);
    return 0;
  }

  const baseline = loadBaseline();
  if (!baseline) {
    saveBaseline(current);
    console.log(`[check-eval-regression] seeded baseline at ${(current * 100).toFixed(1)}%`);
    return 0;
  }

  const drop = baseline.pass_rate - current;
  if (drop >= REGRESSION_THRESHOLD) {
    console.error(`[check-eval-regression] REGRESSION: ${(baseline.pass_rate * 100).toFixed(1)}% -> ${(current * 100).toFixed(1)}% (drop ${(drop * 100).toFixed(1)}%)`);
    await notifyBlocker(
      'Eval regression',
      `Baseline: ${(baseline.pass_rate * 100).toFixed(1)}%\nCurrent: ${(current * 100).toFixed(1)}%\nDrop: ${(drop * 100).toFixed(1)}%\nSet EVAL_BASELINE_UPDATE=1 to accept this as new baseline.`,
    );
    return 1;
  }

  console.log(`[check-eval-regression] OK: ${(current * 100).toFixed(1)}% vs baseline ${(baseline.pass_rate * 100).toFixed(1)}%`);
  return 0;
}

main().then(code => process.exit(code));
