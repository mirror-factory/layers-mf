#!/usr/bin/env tsx
/**
 * scaffold-expect-tests -- emit tests/expect/<slug>.expect.ts skeletons for
 * every route in .ai-dev-kit/registries/pages.yaml that doesn't already
 * have one. Never overwrites. Starts .skip so the push doesn't fail until
 * the author fills in real assertions.
 *
 * Runs: pnpm exec tsx scripts/scaffold-expect-tests.ts
 * Or: invoked by check-expect-coverage failure hint.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const PAGES = join(CWD, '.ai-dev-kit', 'registries', 'pages.yaml');
const OUT_DIR = join(CWD, 'tests', 'expect');

if (!existsSync(PAGES)) {
  console.log('[scaffold-expect] no pages.yaml; nothing to scaffold.');
  process.exit(0);
}

function loadRoutes(): string[] {
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

function skeleton(route: string, slug: string): string {
  return `/**
 * Auto-scaffolded by scaffold-expect-tests.ts for ${route}.
 *
 * Expect drives a real browser and makes natural-language assertions. Fill
 * in the golden-path user flow for this route; extend with edge cases.
 *
 * Start .skip so pre-push passes until you author real assertions. Un-skip
 * when ready.
 *
 * Run: pnpm exec expect tests/expect/${slug}.expect.ts
 */
import { test, expect } from '@anthropic-ai/expect';

test.describe.skip('expect: ${route}', () => {
  test('user can load the page', async ({ page }) => {
    await page.goto('${route.includes('[') ? route.replace(/\[[^\]]+\]/g, 'sample') : route}');
    await expect(page).toMatch('the page is visibly rendered with no console errors');
  });

  // TODO: Add the specific user flows this route supports.
  // Examples:
  //   test('user can ...', async ({ page }) => { ... })
  //   test('error state is readable', async ({ page }) => { ... })
  //   test('mobile viewport works', async ({ page }) => { ... })
});
`;
}

mkdirSync(OUT_DIR, { recursive: true });
const routes = loadRoutes();
let created = 0;
for (const route of routes) {
  const slug = routeToSlug(route);
  const out = join(OUT_DIR, slug + '.expect.ts');
  if (existsSync(out)) {
    console.log('  [exists] ' + route + ' -> ' + out.replace(CWD + '/', ''));
    continue;
  }
  writeFileSync(out, skeleton(route, slug));
  console.log('  [created] ' + route + ' -> ' + out.replace(CWD + '/', ''));
  created++;
}
console.log('[scaffold-expect] ' + created + ' skeleton(s) created across ' + routes.length + ' route(s).');
