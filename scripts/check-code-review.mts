#!/usr/bin/env tsx
/**
 * check-code-review -- pre-push: LLM-as-judge code review over the diff.
 *
 * Runs AFTER the static per-category gates (brand, expect, manifest,
 * dependencies) and BEFORE doctor --strict. The per-category gates catch
 * specific classes of regression; this one catches the general-purpose
 * "would a senior reviewer flag this?" layer.
 *
 * Uses the `code-reviewer` subagent (see templates/.claude/agents/
 * code-reviewer.md) via `aiCall` from lib/ai-call.ts so cost and
 * telemetry flow through the same wrapper every other AI call uses.
 *
 * Fail modes:
 *   * Diff empty                                   -> warn and pass.
 *   * lib/ai-call.ts not installed                 -> warn and pass (kit not adopted).
 *   * Verdict includes ANY security issue          -> FAIL (exit 1).
 *   * Verdict score < THRESHOLD (0.7)              -> FAIL (exit 1).
 *   * Verdict includes `high` perf or clarity      -> warn, do NOT block.
 *   * Reviewer unreachable / JSON unparseable      -> warn and pass
 *     (fail-open on infra flakes; security + score gate still runs next time).
 *
 * Bypass: `REVIEW_SKIP=1`. Counted as a silent regression by audit-rebuild.
 *
 * Cache: `.ai-dev-kit/state/review-cache.json` keyed by `sha256(diff)` so
 * re-pushing the same diff reuses the last verdict and spends zero tokens.
 * Typical cost per push: ~1-5 cents.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';

const CWD = process.cwd();
const CACHE_PATH = join(CWD, '.ai-dev-kit', 'state', 'review-cache.json');
const AGENT_PATH = join(CWD, '.claude', 'agents', 'code-reviewer.md');
const AI_CALL_PATH = join(CWD, 'lib', 'ai-call.ts');
const THRESHOLD = 0.7;
const DIFF_TOKEN_CAP = 8000;
// ~4 chars per token is the conservative rule of thumb. At 8000 tokens that
// is ~32000 chars of diff -- enough for any non-giant feature push.
const DIFF_CHAR_CAP = DIFF_TOKEN_CAP * 4;

interface ReviewIssue {
  file: string;
  line?: number;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface ReviewVerdict {
  security_issues: ReviewIssue[];
  performance_issues: ReviewIssue[];
  clarity_issues: ReviewIssue[];
  test_gaps: Array<{ file: string; description: string }>;
  score: number;
  at?: string;
}

interface Cache { [shaKey: string]: ReviewVerdict }

function loadCache(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  try { return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) as Cache; } catch { return {}; }
}

function saveCache(c: Cache): void {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(c, null, 2));
}

function getDiff(): string {
  try {
    // @{u}..HEAD = commits on this branch that have not been pushed yet.
    // If there is no upstream (first push of a branch), fall back to the
    // merge-base with the default branch.
    const out = execSync('git diff @{u}..HEAD', { cwd: CWD, encoding: 'utf-8' });
    return out;
  } catch {
    try {
      const baseBranch = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo origin/main', { cwd: CWD, encoding: 'utf-8' }).trim().replace(/^\S+\s+->\s+/, '');
      const base = baseBranch || 'origin/main';
      const mergeBase = execSync(`git merge-base ${base} HEAD`, { cwd: CWD, encoding: 'utf-8' }).trim();
      return execSync(`git diff ${mergeBase}..HEAD`, { cwd: CWD, encoding: 'utf-8' });
    } catch {
      return '';
    }
  }
}

function truncateDiff(diff: string): string {
  if (diff.length <= DIFF_CHAR_CAP) return diff;
  // Keep the head (file headers + initial hunks) since that is what the
  // reviewer grounds on, plus a tail marker so it knows it was cut.
  const head = diff.slice(0, DIFF_CHAR_CAP - 200);
  return head + '\n\n... <diff truncated at ' + DIFF_CHAR_CAP + ' chars to stay under ' + DIFF_TOKEN_CAP + ' token budget>';
}

function hashDiff(diff: string): string {
  return createHash('sha256').update(diff).digest('hex').slice(0, 24);
}

async function review(diff: string): Promise<ReviewVerdict | null> {
  if (!existsSync(AI_CALL_PATH)) {
    console.log('[check-code-review] lib/ai-call.ts not present; kit not fully adopted. Skipping.');
    return null;
  }
  if (!existsSync(AGENT_PATH)) {
    console.log('[check-code-review] .claude/agents/code-reviewer.md not present. Skipping.');
    return null;
  }

  try {
    const aiCallMod = await import(AI_CALL_PATH);
    const aiCall = aiCallMod.aiCall as (args: Record<string, unknown>) => Promise<{ text: string }>;
    const agentPrompt = readFileSync(AGENT_PATH, 'utf-8');
    const prompt = [
      'You are the code-reviewer subagent defined below. A pre-push gate is',
      'invoking you with a diff. Return ONLY the JSON verdict described in',
      'the agent contract. No prose. No markdown fences.',
      '',
      '=== AGENT CONTRACT ===',
      agentPrompt,
      '',
      '=== DIFF ===',
      truncateDiff(diff),
    ].join('\n');

    const result = await aiCall({
      mode: 'generate',
      modelId: 'anthropic/claude-sonnet-4.5',
      prompt,
      label: 'code-review',
    });

    const text = typeof result.text === 'string' ? result.text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[check-code-review] reviewer returned no JSON; skipping (fail-open on infra).');
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ReviewVerdict>;
    return {
      security_issues: Array.isArray(parsed.security_issues) ? parsed.security_issues : [],
      performance_issues: Array.isArray(parsed.performance_issues) ? parsed.performance_issues : [],
      clarity_issues: Array.isArray(parsed.clarity_issues) ? parsed.clarity_issues : [],
      test_gaps: Array.isArray(parsed.test_gaps) ? parsed.test_gaps : [],
      score: typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0.5,
    };
  } catch (err) {
    console.warn('[check-code-review] reviewer unreachable: ' + (err as Error).message + ' -- skipping (fail-open).');
    return null;
  }
}

function printVerdict(v: ReviewVerdict): void {
  const mark = (s: string): string => s;
  console.log('  score: ' + v.score.toFixed(2));
  if (v.security_issues.length === 0) {
    console.log('  security:    none');
  } else {
    console.log('  security:    ' + v.security_issues.length + ' issue(s)');
    for (const i of v.security_issues) {
      console.log('    [' + (i.severity ?? 'unknown') + '] ' + i.file + (i.line ? ':' + i.line : '') + ' -- ' + i.description);
    }
  }
  if (v.performance_issues.length === 0) {
    console.log('  performance: none');
  } else {
    console.log('  performance: ' + v.performance_issues.length + ' issue(s)');
    for (const i of v.performance_issues) {
      console.log('    [' + (i.severity ?? 'unknown') + '] ' + i.file + (i.line ? ':' + i.line : '') + ' -- ' + i.description);
    }
  }
  if (v.clarity_issues.length === 0) {
    console.log('  clarity:     none');
  } else {
    console.log('  clarity:     ' + v.clarity_issues.length + ' issue(s)');
    for (const i of v.clarity_issues) {
      console.log('    ' + i.file + (i.line ? ':' + i.line : '') + ' -- ' + i.description);
    }
  }
  if (v.test_gaps.length === 0) {
    console.log('  test gaps:   none');
  } else {
    console.log('  test gaps:   ' + v.test_gaps.length);
    for (const g of v.test_gaps) {
      console.log('    ' + g.file + ' -- ' + g.description);
    }
  }
  void mark;
}

async function main(): Promise<number> {
  if (process.env.REVIEW_SKIP === '1') {
    console.log('[check-code-review] REVIEW_SKIP=1 set; skipping (logged as silent regression).');
    return 0;
  }

  const diff = getDiff();
  if (!diff.trim()) {
    console.log('[check-code-review] no diff to review; skipping.');
    return 0;
  }

  const shaKey = hashDiff(diff);
  const cache = loadCache();
  let verdict: ReviewVerdict | undefined = cache[shaKey];

  if (verdict) {
    console.log('[check-code-review] cache hit for diff ' + shaKey + ' -- reusing verdict.');
  } else {
    const fresh = await review(diff);
    if (fresh == null) {
      // fail-open on reviewer/infra unreachable -- same posture as brand
      // judge pre-0.2.8. Other gates still run after this.
      return 0;
    }
    verdict = fresh;
    cache[shaKey] = { ...verdict, at: new Date().toISOString() };
    saveCache(cache);
  }

  printVerdict(verdict);

  // Warn on any high perf or high clarity, but do not block.
  const highPerf = verdict.performance_issues.filter(i => i.severity === 'high');
  if (highPerf.length > 0) {
    console.warn('[check-code-review] ' + highPerf.length + ' high-severity performance issue(s) (warn, not blocking).');
  }

  // Block on any security issue.
  if (verdict.security_issues.length > 0) {
    console.error('[check-code-review] BLOCKED: ' + verdict.security_issues.length + ' security issue(s) -- any severity fails the push.');
    console.error('  Fix, or override with REVIEW_SKIP=1 (logged as silent regression).');
    return 1;
  }

  // Block on score below threshold.
  if (verdict.score < THRESHOLD) {
    console.error('[check-code-review] BLOCKED: score ' + verdict.score.toFixed(2) + ' < ' + THRESHOLD + ' threshold.');
    console.error('  Fix the issues listed above, or override with REVIEW_SKIP=1 (logged as silent regression).');
    return 1;
  }

  console.log('[check-code-review] OK -- score ' + verdict.score.toFixed(2) + ', no security issues.');
  return 0;
}

main().then(code => process.exit(code)).catch(err => {
  // Soft-fail posture matches check-brand-compliance.mts: never let an
  // unexpected throw block a push. Security + score gating above already
  // did the hard work; any throw at this layer is reviewer infra, which
  // we treat as flakiness.
  console.error('[check-code-review] soft-fail: ' + (err as Error).message);
  process.exit(0);
});
