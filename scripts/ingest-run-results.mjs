#!/usr/bin/env node
/**
 * ingest-run-results -- push vitest / compliance / eval output into .ai-logs/.
 *
 * Runs after tests / compliance / evals. Reads each tool's output file,
 * normalizes each row into an AILogRecord-compatible shape tagged by
 * `source`, appends to .ai-logs/test-<date>.json. log-aggregator and
 * /api/dev-kit/logs/unified pick them up automatically, so every run
 * shows up on the dashboard alongside live AI calls.
 *
 * Invoked from:
 *   - `pnpm test:all` post-script (wired into SCRIPTS_TO_ADD in init)
 *   - CI after each gate
 *
 * No-ops cleanly when an output file is missing.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LOG_DIR = '.ai-logs';
const today = new Date().toISOString().slice(0, 10);
const LOG_FILE = join(LOG_DIR, `run-results-${today}.json`);

function ingest(source, readerFn, candidatePaths) {
  for (const path of candidatePaths) {
    if (!existsSync(path)) continue;
    try {
      const rows = readerFn(path);
      if (rows.length === 0) continue;
      mkdirSync(LOG_DIR, { recursive: true });
      const existing = existsSync(LOG_FILE) ? JSON.parse(readFileSync(LOG_FILE, 'utf-8')) : [];
      writeFileSync(LOG_FILE, JSON.stringify([...existing, ...rows], null, 2));
      process.stdout.write(`  [${source}] ingested ${rows.length} rows from ${path}\n`);
      return;
    } catch (err) {
      process.stderr.write(`  [${source}] skipping ${path}: ${err?.message ?? err}\n`);
    }
  }
}

function ingestVitest(path) {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const tests = Array.isArray(raw.testResults) ? raw.testResults : [];
  const rows = [];
  for (const file of tests) {
    const assertions = file.assertionResults ?? [];
    for (const a of assertions) {
      rows.push({
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        source: 'test',
        userId: 'ci',
        sessionId: 'test-run',
        chatId: file.name ?? '',
        label: a.fullName ?? a.title ?? 'unnamed',
        modelId: 'n/a',
        inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0,
        durationMs: a.duration ?? 0,
        ttftMs: null, steps: 1, toolCalls: [],
        cacheReadTokens: 0, cacheWriteTokens: 0,
        error: a.status === 'failed' ? (a.failureMessages ?? []).join('\n').slice(0, 500) : null,
        finishReason: a.status,
        tokensPerSecond: null, aborted: false,
      });
    }
  }
  return rows;
}

function ingestCompliance(path) {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const checks = Array.isArray(raw.checks) ? raw.checks : Array.isArray(raw) ? raw : [];
  return checks.map(c => ({
    id: `compliance-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    source: 'compliance',
    userId: 'ci',
    sessionId: 'compliance-run',
    chatId: '',
    label: c.name ?? c.label ?? 'check',
    modelId: 'n/a',
    inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0,
    durationMs: 0,
    ttftMs: null, steps: 1, toolCalls: [],
    cacheReadTokens: 0, cacheWriteTokens: 0,
    error: c.pass === false ? (c.message ?? 'failed') : null,
    finishReason: c.pass === false ? 'fail' : c.severity === 'warning' ? 'warn' : 'pass',
    tokensPerSecond: null, aborted: false,
  }));
}

function ingestEval(path) {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const results = Array.isArray(raw.testResults) ? raw.testResults : Array.isArray(raw) ? raw : [];
  return results.flatMap(f => (f.assertionResults ?? []).map(a => ({
    id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    source: 'eval',
    userId: 'ci',
    sessionId: 'eval-run',
    chatId: f.name ?? '',
    label: a.fullName ?? a.title ?? 'unnamed-eval',
    modelId: 'n/a',
    inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0,
    durationMs: a.duration ?? 0,
    ttftMs: null, steps: 1, toolCalls: [],
    cacheReadTokens: 0, cacheWriteTokens: 0,
    error: a.status === 'failed' ? (a.failureMessages ?? []).join('\n').slice(0, 500) : null,
    finishReason: a.status,
    tokensPerSecond: null, aborted: false,
  })));
}

ingest('test', ingestVitest, ['test-results/unit.json', '.test-results/unit.json']);
ingest('eval', ingestEval, ['.test-results/eval-results.json', 'test-results/eval-results.json']);
ingest('compliance', ingestCompliance, ['.test-results/compliance.json', '.evidence/gates/summary.json']);

process.stdout.write(`  Run-results ingested to ${LOG_FILE}. Dashboard will show them alongside live AI calls.\n`);
