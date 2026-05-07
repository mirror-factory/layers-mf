/**
 * Auto-scaffolded by scaffold-expect-tests.ts for /chat.
 *
 * Expect drives a real browser and makes natural-language assertions. Fill
 * in the golden-path user flow for this route; extend with edge cases.
 *
 * Start .skip so pre-push passes until you author real assertions. Un-skip
 * when ready.
 *
 * Run: pnpm exec expect tests/expect/chat.expect.ts
 */
import { test, expect } from '@anthropic-ai/expect';

test.describe.skip('expect: /chat', () => {
  test('user can load the page', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toMatch('the page is visibly rendered with no console errors');
  });

  test('user can attempt a Dewey message from the chat composer', async ({ page }) => {
    await page.goto('/chat');
    await page.fill('textarea, [contenteditable="true"]', 'What does the Library know about this workspace?');
    await page.click('button[type="submit"], button:has-text("Send")');
    await expect(page).toMatch('the chat stays usable and the submitted message or auth boundary is visible');
  });
});
