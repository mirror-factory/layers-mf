/**
 * Auto-scaffolded by scaffold-expect-tests.ts for /chat/[id].
 *
 * Expect drives a real browser and makes natural-language assertions. Fill
 * in the golden-path user flow for this route; extend with edge cases.
 *
 * Start .skip so pre-push passes until you author real assertions. Un-skip
 * when ready.
 *
 * Run: pnpm exec expect tests/expect/chat-id.expect.ts
 */
import { test, expect } from '@anthropic-ai/expect';

test.describe.skip('expect: /chat/[id]', () => {
  test('user can load the page', async ({ page }) => {
    await page.goto('/chat/sample');
    await expect(page).toMatch('the page is visibly rendered with no console errors');
  });

  test('user can attempt a follow-up message in an existing Dewey chat', async ({ page }) => {
    await page.goto('/chat/sample');
    await page.fill('textarea, [contenteditable="true"]', 'Save the useful parts of this conversation to the Library.');
    await page.click('button[type="submit"], button:has-text("Send")');
    await expect(page).toMatch('the chat route handles the message attempt or redirects to authentication without a blank screen');
  });
});
