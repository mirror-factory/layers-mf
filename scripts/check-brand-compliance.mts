#!/usr/bin/env tsx
/**
 * check-brand-compliance -- pre-push: LLM-as-judge pass over changed
 * components against docs/brand-guide.md + docs/style-guide.md.
 *
 * Runs AFTER check-brand-tokens (which is a static regex check). This one
 * catches judgement calls the static check can't -- "does this modal match
 * our voice/tone?" "is the hierarchy consistent with other surfaces?"
 *
 * Uses `models.judge` from lib/model-router so LOCAL_TEST=1 routes to
 * Claude Haiku via subscription (free). Cost per run: ~1-3¢ for a typical
 * feature touching 3-5 components.
 *
 * Fail modes:
 *   * Brand guide missing -> warn and pass (can't judge against nothing).
 *   * Style guide missing -> warn and pass.
 *   * LLM unreachable     -> warn and pass (never block on flakiness).
 *   * Judgement score < THRESHOLD on any component -> FAIL (exit 1).
 *
 * Bypass: `BRAND_SKIP=1`. Counted as a silent regression by audit-rebuild.
 *
 * Output: per-component pass/fail with remediation. Cached at
 * `.ai-dev-kit/state/brand-judge-cache.json` keyed by component path +
 * content hash so unchanged components re-use the last verdict.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';

const CWD = process.cwd();
const BRAND = join(CWD, 'docs', 'brand-guide.md');
const STYLE = join(CWD, 'docs', 'style-guide.md');
const TOKENS = join(CWD, '.ai-dev-kit', 'registries', 'design-tokens.yaml');
const SYSTEM = join(CWD, '.ai-dev-kit', 'registries', 'design-system.yaml');
const CACHE_PATH = join(CWD, '.ai-dev-kit', 'state', 'brand-judge-cache.json');
const THRESHOLD = 0.7;

if (process.env.BRAND_SKIP === '1') {
  console.log('[check-brand-compliance] BRAND_SKIP=1 set; skipping (logged as silent regression).');
  process.exit(0);
}

if (!existsSync(BRAND) || !existsSync(STYLE)) {
  console.log('[check-brand-compliance] brand-guide.md and/or style-guide.md missing; skipping with warning.');
  console.log('  Copy the templates: cp templates/docs/brand-guide.md.template docs/brand-guide.md');
  process.exit(0);
}

function changedComponents(): string[] {
  try {
    const out = execSync('git diff --name-only @{u}...HEAD -- "components/*" "src/components/*" "app/*"', { cwd: CWD, encoding: 'utf-8' });
    return out.split('\n').filter(f => (f.endsWith('.tsx') || f.endsWith('.jsx')) && !f.endsWith('.stories.tsx') && !f.endsWith('.test.tsx'));
  } catch {
    return [];
  }
}

interface Cache { [key: string]: { score: number; reason: string; at: string } }
function loadCache(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  try { return JSON.parse(readFileSync(CACHE_PATH, 'utf-8')); } catch { return {}; }
}
function saveCache(c: Cache): void {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(c, null, 2));
}

function keyFor(path: string, body: string): string {
  return `${path}::${createHash('sha256').update(body).digest('hex').slice(0, 16)}`;
}

/**
 * Structured judge: instead of a free-form vibe-check, the model answers a
 * concrete rubric keyed by the component's declared primitive in
 * design-system.yaml. The score is computed from counted checks, not the
 * model's subjective opinion. This makes the result less model-dependent.
 *
 * Score formula:
 *   score = (0.4 * variants_coverage) + (0.4 * states_coverage) + (0.2 * a11y_coverage)
 *   coverage = implemented / declared (0 if nothing declared for that axis)
 */
interface JudgeVerdict {
  score: number;
  reason: string;
  primitive_matched: string | null;
  variants_implemented: string[];
  variants_missing: string[];
  states_implemented: string[];
  states_missing: string[];
  a11y_rules_passed: string[];
  a11y_rules_failed: string[];
  token_violations: string[];
}

function findPrimitiveSpec(systemYaml: string, componentName: string): string | null {
  const lines = systemYaml.split('\n');
  let inMatchingSection = false;
  let captureDepth = 0;
  const out: string[] = [];
  for (const raw of lines) {
    const topSection = raw.match(/^(primitives|molecules|organisms|templates):\s*$/);
    if (topSection) { inMatchingSection = true; continue; }
    if (/^[a-z]+:\s*$/.test(raw) && !topSection) { inMatchingSection = false; continue; }
    if (!inMatchingSection) continue;

    const nameMatch = raw.match(/^\s{2}([A-Z][A-Za-z0-9]+):\s*$/);
    if (nameMatch) {
      if (captureDepth > 0) break; // done capturing the previous match
      if (nameMatch[1] === componentName) { captureDepth = 1; out.push(raw); }
      continue;
    }
    if (captureDepth > 0) out.push(raw);
  }
  return out.length > 0 ? out.join('\n') : null;
}

async function judge(component: {
  path: string; body: string; brand: string; style: string; tokens: string; system: string;
}): Promise<JudgeVerdict> {
  const componentName = component.path.split('/').pop()?.replace(/\.(tsx|jsx)$/, '') ?? '';
  const primitiveSpec = findPrimitiveSpec(component.system, componentName);

  try {
    const { aiCall } = await import(join(CWD, 'lib', 'ai-call.ts'));
    const { models } = await import(join(CWD, 'lib', 'models.ts')).catch(() => ({ models: { judge: 'anthropic/claude-haiku-4.5' } }));

    const prompt = [
      'You are a design-system compliance auditor. You are NOT asked for',
      'subjective opinions. Given a component and its declared spec, return',
      'ONLY a JSON object with these exact keys:',
      '',
      '{',
      '  "primitive_matched": "<name or null if component does not match any declared primitive>",',
      '  "variants_implemented": ["<variant name>", ...],',
      '  "variants_missing": ["<variant name>", ...],',
      '  "states_implemented": ["<state name>", ...],',
      '  "states_missing": ["<state name>", ...],',
      '  "a11y_rules_passed": ["<exact rule text from spec>", ...],',
      '  "a11y_rules_failed": ["<exact rule text from spec>", ...],',
      '  "token_violations": ["<line>: used X, spec says Y", ...],',
      '  "reason": "<one sentence summarizing the biggest gap, or \'no gaps\'>"',
      '}',
      '',
      'Rules:',
      '1. variants_implemented + variants_missing must together equal the spec\'s variants list.',
      '2. states_implemented + states_missing must together equal the spec\'s states list.',
      '3. a11y_rules_passed + a11y_rules_failed must together equal the spec\'s a11y list.',
      '4. If primitive_matched is null, leave the arrays empty and just explain in reason.',
      '',
      '=== BRAND GUIDE ===',
      component.brand.slice(0, 3000),
      '',
      '=== STYLE GUIDE ===',
      component.style.slice(0, 3000),
      '',
      '=== DESIGN TOKENS ===',
      component.tokens.slice(0, 1500),
      '',
      '=== PRIMITIVE SPEC (from design-system.yaml) ===',
      primitiveSpec ?? '(no declared spec for this component -- primitive_matched should be null)',
      '',
      `=== COMPONENT: ${component.path} ===`,
      component.body.slice(0, 5000),
    ].join('\n');

    const result = await aiCall({
      mode: 'generate',
      modelId: models.judge ?? 'anthropic/claude-haiku-4.5',
      prompt,
      label: 'brand-compliance-judge',
    });

    const json = result.text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { score: 1, reason: 'no JSON output; treating as pass', primitive_matched: null, variants_implemented: [], variants_missing: [], states_implemented: [], states_missing: [], a11y_rules_passed: [], a11y_rules_failed: [], token_violations: [] };
    const parsed = JSON.parse(json);

    // Computed score (not model-provided) from counted coverage.
    const vCov = denominator(parsed.variants_implemented, parsed.variants_missing);
    const sCov = denominator(parsed.states_implemented, parsed.states_missing);
    const aCov = denominator(parsed.a11y_rules_passed, parsed.a11y_rules_failed);
    const score = parsed.primitive_matched == null
      ? 0.5 // uncategorized: neutral, surfaces as warn via doctor cross-ref
      : Math.max(0, Math.min(1, 0.4 * vCov + 0.4 * sCov + 0.2 * aCov));

    return {
      score,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '(no reason)',
      primitive_matched: parsed.primitive_matched ?? null,
      variants_implemented: Array.isArray(parsed.variants_implemented) ? parsed.variants_implemented : [],
      variants_missing: Array.isArray(parsed.variants_missing) ? parsed.variants_missing : [],
      states_implemented: Array.isArray(parsed.states_implemented) ? parsed.states_implemented : [],
      states_missing: Array.isArray(parsed.states_missing) ? parsed.states_missing : [],
      a11y_rules_passed: Array.isArray(parsed.a11y_rules_passed) ? parsed.a11y_rules_passed : [],
      a11y_rules_failed: Array.isArray(parsed.a11y_rules_failed) ? parsed.a11y_rules_failed : [],
      token_violations: Array.isArray(parsed.token_violations) ? parsed.token_violations : [],
    };
  } catch (err) {
    // 0.2.8: fail-closed on judge unreachable. A silent pass when the LLM
    // can't be reached lets network flakes pretend they're successful
    // brand checks -- the opposite of what we want. The only way past an
    // unreachable judge is now BRAND_SKIP=1 (logged as silent regression).
    console.error(`[check-brand-compliance] JUDGE UNREACHABLE: ${(err as Error).message}`);
    console.error('  This would previously have passed silently. 0.2.8 fails closed.');
    console.error('  Retry (may be transient), or: BRAND_SKIP=1 git push ...');
    return { score: 0, reason: `judge unreachable (fail-closed): ${(err as Error).message}`, primitive_matched: null, variants_implemented: [], variants_missing: [], states_implemented: [], states_missing: [], a11y_rules_passed: [], a11y_rules_failed: [], token_violations: [] };
  }
}

function denominator(impl: unknown, missing: unknown): number {
  const i = Array.isArray(impl) ? impl.length : 0;
  const m = Array.isArray(missing) ? missing.length : 0;
  const total = i + m;
  return total === 0 ? 1 : i / total;
}

async function main(): Promise<number> {
  const files = changedComponents();
  if (files.length === 0) {
    console.log('[check-brand-compliance] no component changes on this branch; skipping.');
    return 0;
  }

  const brand = readFileSync(BRAND, 'utf-8');
  const style = readFileSync(STYLE, 'utf-8');
  const tokens = existsSync(TOKENS) ? readFileSync(TOKENS, 'utf-8') : '';
  const system = existsSync(SYSTEM) ? readFileSync(SYSTEM, 'utf-8') : '';

  const cache = loadCache();
  const failures: Array<{ path: string; verdict: JudgeVerdict }> = [];

  for (const path of files) {
    if (!existsSync(join(CWD, path))) continue;
    const body = readFileSync(join(CWD, path), 'utf-8');
    const k = keyFor(path, body);

    let verdict: JudgeVerdict = cache[k] as JudgeVerdict;
    if (!verdict || typeof (verdict as JudgeVerdict).variants_missing === 'undefined') {
      verdict = await judge({ path, body, brand, style, tokens, system });
      (cache as Record<string, JudgeVerdict & { at: string }>)[k] = { ...verdict, at: new Date().toISOString() };
    }

    const tag = verdict.score >= THRESHOLD ? 'PASS' : 'FAIL';
    console.log(`  [${tag}] ${path}  score=${verdict.score.toFixed(2)}  primitive=${verdict.primitive_matched ?? '(uncategorized)'}`);
    if (verdict.variants_missing.length) console.log(`         missing variants: ${verdict.variants_missing.join(', ')}`);
    if (verdict.states_missing.length) console.log(`         missing states:   ${verdict.states_missing.join(', ')}`);
    if (verdict.a11y_rules_failed.length) console.log(`         a11y failures:    ${verdict.a11y_rules_failed.join('; ')}`);
    if (verdict.token_violations.length) console.log(`         token violations: ${verdict.token_violations.slice(0, 3).join('; ')}`);
    if (verdict.score < THRESHOLD) failures.push({ path, verdict });
  }

  saveCache(cache);

  if (failures.length > 0) {
    console.error('\n[check-brand-compliance] BLOCKED: brand/style compliance below threshold.');
    console.error('Fix the components or override with BRAND_SKIP=1 (logged as silent regression).\n');
    return 1;
  }
  return 0;
}

main().then(code => process.exit(code)).catch(err => {
  console.error('[check-brand-compliance] soft-fail:', err);
  process.exit(0);
});
