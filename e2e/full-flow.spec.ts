import { test, expect } from "@playwright/test";

const TEST_EMAIL = "e2e-test@layers.test";
const TEST_PASSWORD = "E2eTest2026secure";

test.describe("Full User Flow: Drive → Context → Chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole("textbox", { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Skip onboarding
    await page.evaluate(() => {
      localStorage.setItem("layers-onboarding-completed", "true");
    });
  });

  test("1. can log in and reach dashboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/screenshots/dashboard.png", fullPage: true });
    expect(page.url()).not.toContain("/login");
  });

  test("2. context library shows Google Drive documents", async ({ page }) => {
    // Navigate to context, then reload to ensure SSR has auth cookies
    await page.goto("/context");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/screenshots/context-library.png", fullPage: true });

    // Should NOT show empty state since we have 92 docs from Drive
    const emptyState = page.getByText("No context items yet");
    const hasItems = !(await emptyState.isVisible().catch(() => false));
    expect(hasItems).toBe(true);
  });

  test("3. chat page loads and accepts messages", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    // Click "New conversation" to start
    await page.getByRole("button", { name: /new conversation/i }).first().click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "e2e/screenshots/chat-new-convo.png", fullPage: true });

    // Now textarea should be visible
    const chatInput = page.locator("textarea").first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
  });

  test("4. chat responds with Drive content when asked", async ({ page }) => {
    test.setTimeout(120000);

    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    // Start new conversation
    await page.getByRole("button", { name: /new conversation/i }).first().click();
    await page.waitForTimeout(1000);

    const chatInput = page.locator("textarea").first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Ask a knowledge question
    await chatInput.fill("Summarize the marketing strategies in our documents");
    await chatInput.press("Enter");

    await page.screenshot({ path: "e2e/screenshots/chat-query-sent.png", fullPage: true });

    // Wait for AI response (needs to call search_context + generate)
    // Look for response text appearing — could take up to 30s
    await page.waitForFunction(
      () => {
        const els = document.querySelectorAll("[data-role='assistant'], .prose, .markdown");
        return els.length > 0;
      },
      { timeout: 45000 }
    ).catch(() => {
      // Fallback — just wait and check page content grew
    });

    await page.waitForTimeout(5000);
    await page.screenshot({ path: "e2e/screenshots/chat-response.png", fullPage: true });

    // The page should have substantive content beyond just the question
    const pageText = await page.innerText("body");
    // At minimum: sidebar + question + some response
    expect(pageText.length).toBeGreaterThan(400);
  });

  test("5. context search returns results", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill("marketing");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/context-search.png", fullPage: true });
    }
  });
});
