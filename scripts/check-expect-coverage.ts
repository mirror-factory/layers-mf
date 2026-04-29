#!/usr/bin/env tsx
/**
 * check-expect-coverage -- pre-push gate that requires AI browser tests
 * (@anthropic-ai/expect) for every page in pages.yaml.
 *
 * Motivation: visual regression catches "did it render" but not "does it
 * behave like a user expects". Expect AI drives a real browser and
 * asserts on what the user sees + can do. Without this gate, expect is
 * opt-in and agents skip it.
 *
 * Policy:
 *   * If pages.yaml is empty or missing: no-op (API-only project).
 *   * If pages.yaml has routes AND @anthropic-ai/expect is NOT a dep:
 *     warn-only on first push, FAIL on second push (tracked via
 *     .ai-dev-kit/state/expect-grace.json timestamp). Grace window is
 *     7 days so projects can adopt gradually.
 *   * If pages.yaml has routes AND expect IS a dep AND any route lacks
 *     a matching `tests/expect/<route-slug>.expect.ts`: FAIL.
 *   * Bypass: EXPECT_SKIP=1 (logged by audit-rebuild as silent regression).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CWD = process.cwd();
const PAGES = join(CWD, '.ai-dev-kit', 'registries', 'pages.yaml');
const GRACE = join(CWD, '.ai-dev-kit', 'state', 'expect-grace.json');
const GRACE_DAYS = 7;

if (process.env.EXPECT_SKIP === '1') {
  console.log('[check-expect-coverage] EXPECT_SKIP=1 set; skipping (silent regression).');
  process.exit(0);
}

function loadRoutes(): string[] {
  if (!existsSync(PAGES)) return [];
  const routes: string[] = [];
  let inEntries = false;
  let currentRoute: string | null = null;
  let currentRemoved = false;
  const commit = () => {
    if (currentRoute && !currentRemoved && !currentRoute.startsWith('/dev-kit')) {
      routes.push(currentRoute);
    }
    currentRoute = null;
    currentRemoved = false;
  };
  for (const raw of readFileSync(PAGES, 'utf-8').split('\n')) {
    if (/^entries:/.test(raw)) { inEntries = true; continue; }
    if (!inEntries) continue;
    const m = raw.match(/^\s+-?\s*route:\s*(.+)$/);
    if (m) {
      commit();
      const route = m[1].trim().replace(/^["']|["']$/g, '');
      currentRoute = route || null;
      continue;
    }
    if (/^\s+removed_on:\s*/.test(raw)) currentRemoved = true;
  }
  commit();
  return routes;
}

function routeToSlug(route: string): string {
  return route.replace(/^\/|\/$/g, '').replace(/\[|\]/g, '').replace(/\//g, '-') || 'home';
}

// 0.2.14: accept either @anthropic-ai/expect or Million's expect-cli.
// Both drive a real browser with LLM assertions; we don't care which one
// the project uses, we just need one of them installed so the scaffolded
// specs can run. Projects that actively used expect-cli before the gate
// was added were being blocked despite having a working AI test runner.
const EXPECT_PACKAGES = ['@anthropic-ai/expect', 'expect-cli'] as const;

function installedExpectPackage(): string | null {
  try {
    const pkg = JSON.parse(readFileSync(join(CWD, 'package.json'), 'utf-8'));
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const name of EXPECT_PACKAGES) {
      if (name in all) return name;
    }
    return null;
  } catch { return null; }
}

function readGrace(): { first_seen?: string } {
  if (!existsSync(GRACE)) return {};
  try { return JSON.parse(readFileSync(GRACE, 'utf-8')); } catch { return {}; }
}

function writeGrace(state: Record<string, unknown>): void {
  mkdirSync(dirname(GRACE), { recursive: true });
  writeFileSync(GRACE, JSON.stringify(state, null, 2));
}

const routes = loadRoutes();
if (routes.length === 0) {
  console.log('[check-expect-coverage] pages.yaml empty or missing; skipping.');
  process.exit(0);
}

const installedPkg = installedExpectPackage();
if (!installedPkg) {
  // 0.2.8: grace window removed. If pages.yaml has user-facing routes,
  // the project needs AI browser tests. Period. Bypass via EXPECT_SKIP=1.
  // 0.2.14: accept either @anthropic-ai/expect or expect-cli.
  console.error('[check-expect-coverage] BLOCKED: no AI browser test runner installed.');
  console.error('  ' + routes.length + ' route(s) in pages.yaml need AI browser tests.');
  console.error('  Install one of: pnpm add -D @anthropic-ai/expect  OR  pnpm add -D expect-cli');
  console.error('  Then scaffold: pnpm exec tsx scripts/scaffold-expect-tests.ts');
  console.error('  Bypass (logged as silent regression): EXPECT_SKIP=1');
  process.exit(1);
}

// expect IS installed; require coverage per route.
const missing: string[] = [];
for (const route of routes) {
  const slug = routeToSlug(route);
  const candidates = [
    join(CWD, 'tests', 'expect', slug + '.expect.ts'),
    join(CWD, 'tests', 'expect', slug + '.spec.ts'),
    join(CWD, 'tests', 'expect', slug, 'index.expect.ts'),
  ];
  if (!candidates.some(p => existsSync(p))) missing.push(route + '  -> tests/expect/' + slug + '.expect.ts');
}

if (missing.length === 0) {
  // Second pass: for routes that likely have chat/form components,
  // verify the expect specs include interaction tests (not just visibility).
  const INTERACTIVE_ROUTES = ['chat', 'generate', 'create', 'design', 'form', 'contact', 'signup', 'login'];
  const INTERACTION_PATTERNS = ['.fill(', '.click(', 'sendMessage', '.type(', '.press(', '.check(', '.selectOption('];
  const interactionWarnings: string[] = [];

  for (const route of routes) {
    const slug = routeToSlug(route);
    const routeName = slug.toLowerCase();
    const isInteractive = INTERACTIVE_ROUTES.some(r => routeName.includes(r));
    if (!isInteractive) continue;

    const candidates = [
      join(CWD, 'tests', 'expect', slug + '.expect.ts'),
      join(CWD, 'tests', 'expect', slug + '.spec.ts'),
      join(CWD, 'tests', 'expect', slug, 'index.expect.ts'),
    ];
    const specPath = candidates.find(p => existsSync(p));
    if (!specPath) continue; // already caught by the missing-file check

    const specContent = readFileSync(specPath, 'utf-8');
    const hasInteraction = INTERACTION_PATTERNS.some(p => specContent.includes(p));
    if (!hasInteraction) {
      interactionWarnings.push(
        `${route} -> tests/expect/${slug}.expect.ts has no interaction tests (.fill, .click, sendMessage). ` +
        `Chat/form routes need tests that actually submit input, not just check visibility.`
      );
    }
  }

  if (interactionWarnings.length > 0) {
    console.error('\n[check-expect-coverage] WARNING: ' + interactionWarnings.length + ' interactive route(s) lack interaction tests.');
    console.error('These specs only check visibility — they should test real user flows:\n');
    for (const w of interactionWarnings) console.error('  ' + w);
    console.error('');
  }

  console.log('[check-expect-coverage] OK: all ' + routes.length + ' routes have expect specs.');
  process.exit(0);
}

console.error('\n[check-expect-coverage] BLOCKED: ' + missing.length + ' of ' + routes.length + ' routes lack AI browser tests.');
console.error('');
for (const m of missing.slice(0, 12)) console.error('  ' + m);
if (missing.length > 12) console.error('  ... +' + (missing.length - 12) + ' more');
console.error('');
console.error('Every user-facing route needs an expect spec so the agent can\'t');
console.error('ship a feature that "renders" but doesn\'t actually work when a');
console.error('real user clicks through it.');
console.error('');
console.error('Scaffold all missing: `pnpm exec tsx scripts/scaffold-expect-tests.ts`');
console.error('Then fill in the assertions per-page.');
console.error('');
console.error('Bypass (not recommended; logged as silent regression):');
console.error('  EXPECT_SKIP=1 git push ...');
console.error('');
process.exit(1);
