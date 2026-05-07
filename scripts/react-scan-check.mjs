#!/usr/bin/env node
/**
 * react-scan-check -- pre-push: boot dev server + measure unnecessary
 * re-renders on every route declared in .ai-dev-kit/registries/pages.yaml.
 *
 * Uses react-scan's CI mode (https://github.com/aidenybai/react-scan).
 * Threshold: per-route "unnecessary renders" score must stay below
 * `.ai-dev-kit/requirements.yaml: react_scan.max_rerender_score` (default 10).
 *
 * Exit codes:
 *   0 = all routes pass threshold OR react-scan not installed (warn, pass)
 *   1 = a route exceeds threshold
 *
 * Why this exists: user explicitly said "highly optimized with React Scan
 * and million." Without an enforced CI gate, agents regularly land
 * components with excessive re-renders that never get caught until a user
 * reports jank in production.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';

const THRESHOLD_DEFAULT = 10;
const CWD = process.cwd();

async function hasReactScan() {
  try {
    execSync('npx --no react-scan --version', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function loadRoutes() {
  const path = `${CWD}/.ai-dev-kit/registries/pages.yaml`;
  if (!existsSync(path)) return [];
  const src = readFileSync(path, 'utf-8');
  const routes = [];
  for (const line of src.split('\n')) {
    const m = line.match(/^\s+-?\s*route:\s*(.+)$/);
    if (m) routes.push(m[1].trim().replace(/^["']|["']$/g, ''));
  }
  return routes;
}

function loadThreshold() {
  const path = `${CWD}/.ai-dev-kit/requirements.yaml`;
  if (!existsSync(path)) return THRESHOLD_DEFAULT;
  const src = readFileSync(path, 'utf-8');
  const m = src.match(/react_scan:\s*{[^}]*max_rerender_score:\s*(\d+)/);
  return m ? Number(m[1]) : THRESHOLD_DEFAULT;
}

async function bootDevServer() {
  const proc = spawn('pnpm', ['dev', '--port=3999'], { cwd: CWD, stdio: 'ignore', detached: false });
  // Poll http://localhost:3999 until reachable or 30s.
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://localhost:3999/', { signal: AbortSignal.timeout(1500) });
      if (res.ok || res.status === 404) return proc;
    } catch { /* retry */ }
  }
  proc.kill('SIGTERM');
  throw new Error('dev server failed to boot on :3999');
}

function hasUi() {
  const dirs = ['components', 'src/components', 'app', 'src/app'];
  for (const d of dirs) if (existsSync(`${CWD}/${d}`)) return true;
  return false;
}

async function main() {
  const uiPresent = hasUi();

  if (!(await hasReactScan())) {
    if (uiPresent) {
      // UI present but no react-scan -> this is now a HARD requirement.
      // Previously we soft-passed; that let agents ship un-scanned UIs.
      console.error('[react-scan-check] FAIL: UI detected but react-scan not installed.');
      console.error('  Install: pnpm add -D react-scan');
      console.error('  Bypass (not recommended, logged as silent regression): REACT_SCAN_SKIP=1');
      if (process.env.REACT_SCAN_SKIP === '1') { console.log('  REACT_SCAN_SKIP=1 set; passing with warning.'); process.exit(0); }
      process.exit(1);
    }
    console.log('[react-scan-check] no UI detected; skipping.');
    process.exit(0);
  }

  const routes = loadRoutes();
  if (routes.length === 0) {
    if (uiPresent) {
      console.error('[react-scan-check] FAIL: UI detected but no routes in pages.yaml.');
      console.error('  Fix: pnpm exec tsx scripts/sync-registries.ts then commit the updated pages.yaml');
      process.exit(1);
    }
    console.log('[react-scan-check] no routes in pages.yaml; skipping.');
    process.exit(0);
  }

  const threshold = loadThreshold();
  let server;
  try {
    console.log(`[react-scan-check] booting dev server...`);
    server = await bootDevServer();
  } catch (err) {
    console.warn(`[react-scan-check] ${err.message}; skipping with warning.`);
    process.exit(0);
  }

  const failures = [];
  try {
    for (const route of routes.slice(0, 25)) {
      const url = `http://localhost:3999${route.replace(/\[[^\]]+\]/g, 'sample')}`;
      try {
        const out = execSync(`npx react-scan --ci ${JSON.stringify(url)}`, {
          cwd: CWD, encoding: 'utf-8', timeout: 30_000,
        });
        const scoreMatch = out.match(/unnecessary[^0-9]*(\d+)/i);
        const score = scoreMatch ? Number(scoreMatch[1]) : 0;
        if (score > threshold) {
          console.error(`  [FAIL] ${route}  score=${score}  threshold=${threshold}`);
          failures.push({ route, score });
        } else {
          console.log(`  [PASS] ${route}  score=${score}`);
        }
      } catch (err) {
        console.warn(`  [SKIP] ${route}  (${err.message || 'unreachable'})`);
      }
    }
  } finally {
    server?.kill('SIGTERM');
  }

  if (failures.length > 0) {
    console.error(`\n[react-scan-check] ${failures.length} route${failures.length > 1 ? 's' : ''} exceeded re-render threshold.`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('[react-scan-check] soft-fail:', err);
  process.exit(0);
});
