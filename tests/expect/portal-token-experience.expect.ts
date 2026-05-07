/**
 * Auto-scaffolded by scaffold-expect-tests.ts for /portal/[token]/experience.
 *
 * Expect drives a real browser and makes natural-language assertions. Fill
 * in the golden-path user flow for this route; extend with edge cases.
 *
 * Start .skip so pre-push passes until you author real assertions. Un-skip
 * when ready.
 *
 * Run: pnpm exec expect tests/expect/portal-token-experience.expect.ts
 */
import { test, expect } from '@anthropic-ai/expect';

test.describe.skip('expect: /portal/[token]/experience', () => {
  test('user can load the page', async ({ page }) => {
    await page.goto('/portal/sample/experience');
    await expect(page).toMatch('the page is visibly rendered with no console errors');
  });

  // TODO: Add the specific user flows this route supports.
  // Examples:
  //   test('user can ...', async ({ page }) => { ... })
  //   test('error state is readable', async ({ page }) => { ... })
  //   test('mobile viewport works', async ({ page }) => { ... })
});
