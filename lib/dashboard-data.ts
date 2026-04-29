/**
 * Dashboard Data Aggregator -- server-side data for the tests dashboard.
 *
 * Reads from registries + .evidence/* files. Every value is DERIVED dynamically.
 * All file reads gracefully degrade -- missing evidence files return null.
 *
 * HOW TO CUSTOMIZE:
 * 1. Update registry imports for your project
 * 2. Add/remove data sources as needed
 * 3. Wire into your tests dashboard page
 *
 * Copied from vercel-ai-dev-kit. Customize for your project.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GateEntry { gate: string; required: boolean; pass: boolean; message: string; }
export interface GateSummary { timestamp: string; required: { total: number; passed: number; failed: number }; recommended: { total: number; passed: number; failed: number }; gates: GateEntry[]; }
export interface RubricSummary { timestamp: string; totalTools: number; toolsWithMocks: number; averagePassRate: number; averageScore: number; lowPerformers: Array<{ tool: string; category: string; overallPassRate: number }>; }

export interface DashboardData {
  generatedAt: string;
  gates: GateSummary | null;
  tools: { total: number };
  tests: { unit: number; unitFiles: number; e2e: number };
  rubrics: RubricSummary | null;
  skills: number;
  loadTest: { available: boolean; p50: number | null; timestamp: string | null };
  videos: { available: boolean; count: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson<T>(relPath: string): T | null {
  try {
    const full = resolve(process.cwd(), relPath);
    if (!existsSync(full)) return null;
    return JSON.parse(readFileSync(full, 'utf-8')) as T;
  } catch { return null; }
}

function countFiles(dir: string, predicate: (name: string) => boolean, max = 2000): number {
  const root = resolve(process.cwd(), dir);
  if (!existsSync(root)) return 0;
  let count = 0;
  const stack: string[] = [root];
  while (stack.length > 0 && count < max) {
    const current = stack.pop()!;
    let entries;
    try { entries = readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && predicate(entry.name)) count++;
    }
  }
  return count;
}

function countDirs(dir: string): number {
  const root = resolve(process.cwd(), dir);
  if (!existsSync(root)) return 0;
  try { return readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.')).length; } catch { return 0; }
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

function loadGates(): GateSummary | null {
  return readJson<GateSummary>('.evidence/gates/summary.json');
}

function loadRubrics(): RubricSummary | null {
  return readJson<RubricSummary>('.evidence/rubrics/_summary.json');
}

function loadLoadTest(): DashboardData['loadTest'] {
  const report = readJson<{ timestamp?: string; results?: Array<{ latency?: { p50?: number }; error?: string }> }>('.evidence/load-tests/latest.json');
  if (!report?.results?.length) return { available: false, p50: null, timestamp: null };
  const p50s = report.results.filter((r): r is { latency: { p50: number } } => !!r.latency && typeof r.latency.p50 === 'number').map(r => r.latency.p50);
  return { available: true, p50: p50s.length > 0 ? Math.round(p50s.reduce((a, b) => a + b, 0) / p50s.length) : null, timestamp: report.timestamp ?? null };
}

function loadVideos(): DashboardData['videos'] {
  let count = 0;
  for (const dir of ['.evidence/videos', '.evidence/mobile']) {
    count += countFiles(dir, name => /\.(webm|mp4|mov|html|gif|png|jpg|jpeg)$/i.test(name));
  }
  return { available: count > 0, count };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDashboardData(): Promise<DashboardData> {
  return {
    generatedAt: new Date().toISOString(),
    gates: loadGates(),
    // TODO: Wire up your tool registry count
    tools: { total: 0 },
    tests: {
      // TODO: Wire up your test count registry or scan
      unit: 0,
      unitFiles: 0,
      e2e: countFiles('tests/e2e', name => name.endsWith('.spec.ts')),
    },
    rubrics: loadRubrics(),
    skills: countDirs('.claude/skills'),
    loadTest: loadLoadTest(),
    videos: loadVideos(),
  };
}

export function gatesPassingLabel(gates: GateSummary | null): { tone: 'pass' | 'warn' | 'fail' | 'unknown'; required: string; recommended: string } {
  if (!gates) return { tone: 'unknown', required: '0/0', recommended: '0/0' };
  const allReq = gates.required.passed === gates.required.total && gates.required.total > 0;
  const allRec = gates.recommended.passed === gates.recommended.total;
  return {
    tone: !allReq ? 'fail' : !allRec ? 'warn' : 'pass',
    required: `${gates.required.passed}/${gates.required.total}`,
    recommended: `${gates.recommended.passed}/${gates.recommended.total}`,
  };
}
