#!/usr/bin/env tsx
/**
 * check-budget -- pre-push: sum costs from .ai-logs for the current run /
 * day / month, fail when hard_usd threshold crossed.
 *
 * Reads `.ai-dev-kit/budget.yaml` for thresholds. Each logAICall record
 * carries { costMode, estimated_cost_usd } (since 0.2.0). `costMode` of
 * 'subscription' and 'local' don't count toward billable spend. Vendor
 * calls via `withExternalCall` emit cost_source: 'vendor_api' which
 * always counts.
 *
 * Exit codes:
 *   0 = under all thresholds, or no budget file
 *   1 = crossed a hard threshold
 *
 * A soft threshold cross emits progress notify but doesn't block.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const BUDGET = join(CWD, '.ai-dev-kit', 'budget.yaml');
const LOGS = join(CWD, '.ai-logs');
const STATE = join(CWD, '.ai-dev-kit', 'state', 'current-run.json');

interface Budget {
  per_run?: { soft_usd?: number; hard_usd?: number };
  per_day?: { soft_usd?: number; hard_usd?: number };
  per_month?: { soft_usd?: number; hard_usd?: number };
  per_call_alert_usd?: number;
}

function loadBudget(): Budget | null {
  if (!existsSync(BUDGET)) return null;
  const src = readFileSync(BUDGET, 'utf-8');
  const budget: Budget = {};

  let section: 'per_run' | 'per_day' | 'per_month' | null = null;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const topMatch = line.match(/^(per_run|per_day|per_month):\s*$/);
    if (topMatch) { section = topMatch[1] as typeof section; budget[section!] = {}; continue; }
    const alertMatch = line.match(/^per_call_alert_usd:\s*([\d.]+)$/);
    if (alertMatch) { budget.per_call_alert_usd = Number(alertMatch[1]); continue; }

    if (section) {
      const kv = line.match(/^\s+(soft_usd|hard_usd):\s*([\d.]+)$/);
      if (kv) budget[section]![kv[1] as 'soft_usd' | 'hard_usd'] = Number(kv[2]);
    }
  }
  return budget;
}

function loadCurrentRunId(): string | null {
  if (!existsSync(STATE)) return null;
  try { return JSON.parse(readFileSync(STATE, 'utf-8')).run_id ?? null; } catch { return null; }
}

interface LogRecord {
  run_id?: string | null;
  costMode?: string;
  estimated_cost_usd?: number | null;
  ts?: string;
}

function readLogs(): LogRecord[] {
  if (!existsSync(LOGS)) return [];
  const out: LogRecord[] = [];
  for (const file of readdirSync(LOGS)) {
    if (!file.endsWith('.json') && !file.endsWith('.jsonl')) continue;
    const path = join(LOGS, file);
    try {
      const src = readFileSync(path, 'utf-8');
      for (const line of src.split('\n')) {
        if (!line.trim()) continue;
        try { out.push(JSON.parse(line)); } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return out;
}

function billable(r: LogRecord): boolean {
  if (r.costMode === 'subscription' || r.costMode === 'local') return false;
  return typeof r.estimated_cost_usd === 'number';
}

async function notify(kind: 'progress' | 'blocker', title: string, body: string): Promise<void> {
  try {
    const mod = await import(join(CWD, 'lib', 'notify.ts'));
    await mod.notify({ kind, title, body });
  } catch { /* silent */ }
}

async function main(): Promise<number> {
  const budget = loadBudget();
  if (!budget) {
    console.log('[check-budget] no .ai-dev-kit/budget.yaml; skipping.');
    return 0;
  }

  const runId = loadCurrentRunId();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const logs = readLogs().filter(billable);
  const runSum = runId ? logs.filter(r => r.run_id === runId).reduce((a, r) => a + (r.estimated_cost_usd ?? 0), 0) : 0;
  const daySum = logs.filter(r => (r.ts ?? '') >= startOfDay).reduce((a, r) => a + (r.estimated_cost_usd ?? 0), 0);
  const monthSum = logs.filter(r => (r.ts ?? '') >= startOfMonth).reduce((a, r) => a + (r.estimated_cost_usd ?? 0), 0);

  const results: Array<{ label: string; sum: number; soft?: number; hard?: number }> = [
    { label: 'per_run',   sum: runSum,   soft: budget.per_run?.soft_usd,   hard: budget.per_run?.hard_usd },
    { label: 'per_day',   sum: daySum,   soft: budget.per_day?.soft_usd,   hard: budget.per_day?.hard_usd },
    { label: 'per_month', sum: monthSum, soft: budget.per_month?.soft_usd, hard: budget.per_month?.hard_usd },
  ];

  let hardCrossed = false;
  for (const r of results) {
    const line = `  ${r.label.padEnd(10)} $${r.sum.toFixed(4)}  soft=${r.soft ?? '—'}  hard=${r.hard ?? '—'}`;
    if (r.hard != null && r.sum > r.hard) {
      console.error(line + '  [HARD EXCEEDED]');
      await notify('blocker', `Budget exceeded: ${r.label}`, `$${r.sum.toFixed(4)} > hard limit $${r.hard}`);
      hardCrossed = true;
    } else if (r.soft != null && r.sum > r.soft) {
      console.warn(line + '  [soft exceeded]');
      await notify('progress', `Budget soft: ${r.label}`, `$${r.sum.toFixed(4)} > soft limit $${r.soft}`);
    } else {
      console.log(line);
    }
  }

  return hardCrossed ? 1 : 0;
}

main().then(code => process.exit(code));
