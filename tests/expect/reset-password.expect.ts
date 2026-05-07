/**
 * Auto-scaffolded by scaffold-expect-tests.ts for /reset-password.
 *
 * Expect drives a real browser and makes natural-language assertions. Fill
 * in the golden-path user flow for this route; extend with edge cases.
 *
 * Start .skip so pre-push passes until you author real assertions. Un-skip
 * when ready.
 *
 * Run: pnpm exec expect tests/expect/reset-password.expect.ts
 */
import { test, expect } from '@anthropic-ai/expect';

test.describe.skip('expect: /reset-password', () => {
  test('user can load the page', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page).toMatch('the page is visibly rendered with no console errors');
  });

  // TODO: Add the specific user flows this route supports.
  // Examples:
  //   test('user can ...', async ({ page }) => { ... })
  //   test('error state is readable', async ({ page }) => { ... })
  //   test('mobile viewport works', async ({ page }) => { ... })
});
