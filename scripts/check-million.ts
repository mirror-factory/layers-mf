#!/usr/bin/env tsx
/**
 * check-million -- verify million.js compiled markers appear in the Next.js
 * build output.
 *
 * million wraps React components in a virtual-DOM-free fast path.
 * It only fires when the million plugin is active in `next.config`.
 * v2 uses `million/next`, v3 uses `million/compiler` -- both are valid.
 * A common regression: someone removes the plugin (merge conflict, next.js
 * upgrade) and the build succeeds but the optimization stops applying.
 *
 * This check:
 *   1. Confirms `next.config.{js,mjs,ts}` imports from 'million/next' or 'million/compiler'.
 *   2. After `pnpm build`, greps `.next/server/**` for million's runtime
 *      markers (`__MILLION__`).
 *   3. Fails pre-push if the build completes but no million markers exist.
 *
 * Soft-pass conditions (warn only):
 *   * `.next` doesn't exist yet (first run, build skipped).
 *   * million isn't a dependency (project opted out).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();

function hasMillionDep(): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(CWD, 'package.json'), 'utf-8'));
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return 'million' in all;
  } catch { return false; }
}

function nextConfigReferencesMillion(): boolean {
  for (const f of ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.cjs']) {
    const p = join(CWD, f);
    if (!existsSync(p)) continue;
    const src = readFileSync(p, 'utf-8');
    // Accept both million/next (v2) and million/compiler (v3) import patterns.
    if (/million\/(next|compiler)|require\(['"]million\/(next|compiler)['"]\)|from ['"]million\/(next|compiler)['"]/.test(src)) return true;
  }
  return false;
}

function findMillionMarkers(): boolean {
  const nextDir = join(CWD, '.next');
  if (!existsSync(nextDir)) return false;
  const stack = [nextDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const entry of entries) {
      const full = join(dir, entry);
      let st: ReturnType<typeof statSync>;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) stack.push(full);
      else if (/\.(js|cjs|mjs)$/.test(entry)) {
        try {
          const src = readFileSync(full, 'utf-8');
          if (src.includes('__MILLION__') || /million(?:\/react)?/.test(src)) return true;
        } catch { /* skip */ }
      }
    }
  }
  return false;
}

function hasUi(): boolean {
  for (const d of ['components', 'src/components', 'app', 'src/app']) {
    if (existsSync(join(CWD, d))) return true;
  }
  return false;
}

function main(): number {
  if (!hasMillionDep()) {
    // Previously soft-passed. Now: UI projects should opt in explicitly via
    // `.ai-dev-kit/requirements.yaml: million: required` OR include million
    // in deps. When requirements say required and dep missing, FAIL.
    const reqPath = join(CWD, '.ai-dev-kit', 'requirements.yaml');
    if (hasUi() && existsSync(reqPath)) {
      const src = readFileSync(reqPath, 'utf-8');
      if (/^\s*million:\s*required\s*$/m.test(src)) {
        console.error('[check-million] FAIL: million: required in requirements.yaml but not installed.');
        console.error('  Install: pnpm add million');
        return 1;
      }
    }
    console.log('[check-million] million not in deps; skipping (project opted out).');
    return 0;
  }
  if (!nextConfigReferencesMillion()) {
    console.error('[check-million] FAIL: million is installed but next.config does not import from "million/next" or "million/compiler".');
    console.error('  Fix (v3): import million from "million/compiler"; export default million.next(yourConfig);');
    console.error('  Fix (v2): import millionNext from "million/next"; module.exports = millionNext(yourConfig);');
    return 1;
  }
  if (!existsSync(join(CWD, '.next'))) {
    console.log('[check-million] .next/ not built yet; skipping with warning. Run `pnpm build` first.');
    return 0;
  }
  if (!findMillionMarkers()) {
    console.error('[check-million] FAIL: million compiled markers not found in .next/. Optimization is not applying.');
    return 1;
  }
  console.log('[check-million] million active: markers found in build output.');
  return 0;
}

process.exit(main());
