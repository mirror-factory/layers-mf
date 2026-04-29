#!/usr/bin/env tsx
/**
 * check-impl-doc-diff -- OPT-IN pre-push: verifies the implementation
 * of flagged libraries still matches current upstream docs.
 *
 * Orthogonal to `check-docs-lookup-coverage.ts`:
 *   * docs-lookup-coverage answers "did the agent look up docs during
 *     this run?" (process gate).
 *   * impl-doc-diff answers "does the code on disk still match the
 *     shape the docs describe?" (outcome gate, catches docs that
 *     shipped updates AFTER the agent read them).
 *
 * Runs only when:
 *   * IMPL_DOC_DIFF=1 is set in the environment, OR
 *   * `.ai-dev-kit/requirements.yaml` contains `impl_doc_diff: required`
 *
 * Short-circuits when:
 *   * Diff empty                                         -> pass silently.
 *   * Diff touches zero flagged libraries                -> pass silently.
 *   * .claude/agents/impl-doc-diff.md not installed      -> warn + pass.
 *   * lib/ai-call.ts not installed                       -> warn + pass.
 *
 * Fail modes:
 *   * Any finding with severity >= high                  -> FAIL (exit 1).
 *   * Findings cap reached (>10)                         -> FAIL (exit 1).
 *   * Reviewer unreachable / JSON unparseable            -> warn + pass
 *     (fail-open on infra flakes; the 7-day context7 TTL is the main
 *     line of defense; this is a belt-and-suspenders gate).
 *
 * Bypass: IMPL_DOC_DIFF_SKIP=1 (silent regression).
 *
 * Cost: only fires when the diff touches a flagged library. Expected
 * cadence: a few pushes per week on an active project. ~3-10 cents per
 * run (Sonnet + one Context7 re-fetch per library).
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const AGENT_PATH = join(CWD, '.claude', 'agents', 'impl-doc-diff.md');
const AI_CALL_PATH = join(CWD, 'lib', 'ai-call.ts');
const REQUIREMENTS_PATH = join(CWD, '.ai-dev-kit', 'requirements.yaml');
const CONTEXT7_HOOK = join(CWD, '.claude', 'hooks', 'context7-suggest.py');
const MAX_FINDINGS = 10;

if (process.env.IMPL_DOC_DIFF_SKIP === '1') {
  console.log('[check-impl-doc-diff] IMPL_DOC_DIFF_SKIP=1; skipping (silent regression).');
  process.exit(0);
}

function isEnabled(): boolean {
  if (process.env.IMPL_DOC_DIFF === '1') return true;
  if (!existsSync(REQUIREMENTS_PATH)) return false;
  try {
    const src = readFileSync(REQUIREMENTS_PATH, 'utf-8');
    return /^\s*impl_doc_diff:\s*required\s*$/m.test(src);
  } catch { return false; }
}

if (!isEnabled()) {
  // Default posture: opt-in. Silent when not enabled.
  process.exit(0);
}

if (!existsSync(AGENT_PATH)) {
  console.warn('[check-impl-doc-diff] .claude/agents/impl-doc-diff.md not installed; skipping.');
  process.exit(0);
}

if (!existsSync(AI_CALL_PATH)) {
  console.warn('[check-impl-doc-diff] lib/ai-call.ts not installed; skipping (kit not fully adopted).');
  process.exit(0);
}

// Read the flagged-library list from context7-suggest.py. Single source
// of truth -- keeps edit-time and pre-push in sync.
function readFlaggedLibraries(): string[] {
  if (!existsSync(CONTEXT7_HOOK)) return [];
  try {
    const src = readFileSync(CONTEXT7_HOOK, 'utf-8');
    // Parse FLAGGED_LIBRARIES = { "name": ..., ... }
    const m = src.match(/FLAGGED_LIBRARIES\s*=\s*\{([\s\S]*?)\n\}/);
    if (!m) return [];
    const body = m[1];
    const libs: string[] = [];
    for (const line of body.split('\n')) {
      const km = line.match(/^\s*["']([^"']+)["']\s*:/);
      if (km) libs.push(km[1]);
    }
    return libs;
  } catch { return []; }
}

function getDiff(): string {
  try {
    return execSync('git diff @{u}..HEAD', { encoding: 'utf-8', cwd: CWD, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    try {
      return execSync('git diff origin/main...HEAD', { encoding: 'utf-8', cwd: CWD, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch { return ''; }
  }
}

function touchedLibraries(diff: string, flagged: string[]): string[] {
  if (!diff) return [];
  const hit = new Set<string>();
  for (const lib of flagged) {
    // Match `from 'lib'`, `from "lib"`, `require('lib')` in added lines.
    // Escape regex metachars in library name.
    const esc = lib.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^\\+.*(?:from\\s+["']${esc}(?:/[^"']*)?["']|require\\(["']${esc}(?:/[^"']*)?["']\\))`, 'm');
    if (re.test(diff)) hit.add(lib);
  }
  return [...hit];
}

const flagged = readFlaggedLibraries();
if (flagged.length === 0) {
  console.log('[check-impl-doc-diff] no flagged libraries configured in context7-suggest.py; skipping.');
  process.exit(0);
}

const diff = getDiff();
if (!diff) {
  console.log('[check-impl-doc-diff] diff empty; skipping.');
  process.exit(0);
}

const touched = touchedLibraries(diff, flagged);
if (touched.length === 0) {
  // Narrow scope: never runs when the diff touches no flagged library.
  process.exit(0);
}

console.log(`[check-impl-doc-diff] touched ${touched.length} flagged libraries: ${touched.join(', ')}`);
console.log('[check-impl-doc-diff] invoking @impl-doc-diff subagent ...');

// Delegate the actual LLM work to the subagent via the Task tool. We
// invoke through `claude -p` in non-interactive mode so the subagent
// runs inside the Claude Code harness with Context7 MCP access.
// Fail-open: any infra failure here means the 7-day TTL gate (which
// runs at edit time) is still protecting us.
interface Finding {
  library: string;
  file: string;
  line?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  fix?: string;
  doc_url?: string;
}

interface Verdict {
  libraries_checked: string[];
  findings: Finding[];
  ran_on: string;
}

function invokeSubagent(libs: string[]): Verdict | null {
  const prompt = [
    'You are the @impl-doc-diff subagent. Libraries touched in this diff: ' + libs.join(', ') + '.',
    'For each library, re-fetch current Context7 docs, LLM-compare to the diff below, and emit JSON per the schema in .claude/agents/impl-doc-diff.md.',
    '',
    'Diff (truncated to 32000 chars):',
    '```',
    diff.slice(0, 32000),
    '```',
    '',
    'Emit ONLY the JSON object, no prose.',
  ].join('\n');

  try {
    const out = execSync(`claude -p --output-format=text --max-turns=6`, {
      input: prompt,
      encoding: 'utf-8',
      cwd: CWD,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5 * 60_000,
    });
    const jsonMatch = out.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as Verdict;
  } catch {
    return null;
  }
}

const verdict = invokeSubagent(touched);
if (!verdict) {
  console.warn('[check-impl-doc-diff] subagent unreachable or returned unparseable output; fail-open.');
  console.warn('  The 7-day context7 TTL still protects the edit-time path.');
  process.exit(0);
}

const blocking = verdict.findings.filter(f => f.severity === 'high' || f.severity === 'critical');
if (blocking.length === 0) {
  const warnings = verdict.findings.filter(f => f.severity === 'medium' || f.severity === 'low');
  if (warnings.length > 0) {
    console.log(`[check-impl-doc-diff] PASS with ${warnings.length} non-blocking warning(s):`);
    for (const w of warnings.slice(0, 5)) {
      console.log(`  ${w.library} ${w.file}${w.line ? ':' + w.line : ''} -- ${w.description}`);
    }
  } else {
    console.log(`[check-impl-doc-diff] OK: ${verdict.libraries_checked.length} libraries verified against current docs.`);
  }
  process.exit(0);
}

console.error('');
console.error(`[check-impl-doc-diff] BLOCKED: ${blocking.length} finding(s) where impl diverges from current docs.`);
console.error('');
for (const f of blocking.slice(0, MAX_FINDINGS)) {
  console.error(`  [${f.severity.toUpperCase()}] ${f.library} ${f.file}${f.line ? ':' + f.line : ''}`);
  console.error(`    ${f.description}`);
  if (f.fix) console.error(`    Fix: ${f.fix}`);
  if (f.doc_url) console.error(`    Docs: ${f.doc_url}`);
  console.error('');
}
if (blocking.length > MAX_FINDINGS) {
  console.error(`  ... +${blocking.length - MAX_FINDINGS} more`);
  console.error('');
}
console.error('Bypass (silent regression, logged): IMPL_DOC_DIFF_SKIP=1');
process.exit(1);
