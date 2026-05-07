/**
 * Auto-scaffolded by scaffold-expect-tests.ts for /signup.
 *
 * Expect drives a real browser and makes natural-language assertions. Fill
 * in the golden-path user flow for this route; extend with edge cases.
 *
 * Start .skip so pre-push passes until you author real assertions. Un-skip
 * when ready.
 *
 * Run: pnpm exec expect tests/expect/signup.expect.ts
 */
import { test, expect } from '@anthropic-ai/expect';

test.describe.skip('expect: /signup', () => {
  test('user can load the page', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toMatch('the page is visibly rendered with no console errors');
  });

  test('empty signup submission keeps the user oriented', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('input[type="email"]', '');
    await page.fill('input[type="password"]', '');
    await page.click('button[type="submit"]');
    await expect(page).toMatch('the signup form remains visible with clear validation or required-field messaging');
  });
});
