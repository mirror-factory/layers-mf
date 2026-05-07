/**
 * Auto-scaffolded by scaffold-expect-tests.ts for /login.
 *
 * Expect drives a real browser and makes natural-language assertions. Fill
 * in the golden-path user flow for this route; extend with edge cases.
 *
 * Start .skip so pre-push passes until you author real assertions. Un-skip
 * when ready.
 *
 * Run: pnpm exec expect tests/expect/login.expect.ts
 */
import { test, expect } from '@anthropic-ai/expect';

test.describe.skip('expect: /login', () => {
  test('user can load the page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toMatch('the page is visibly rendered with no console errors');
  });

  test('empty login submission shows a readable validation state', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', '');
    await page.fill('input[type="password"]', '');
    await page.click('button[type="submit"]');
    await expect(page).toMatch('the login form stays visible and explains what needs to be fixed');
  });
});
