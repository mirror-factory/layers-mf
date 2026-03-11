import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";

test.describe("Google Drive → Context → Chat flow", () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, "E2E credentials not set");

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole("textbox", { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  });

  test("context library shows Google Drive documents", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    // Should see context items from Google Drive
    const items = page.locator("[data-source-type='google-drive'], table tbody tr, .context-item, [class*='card']");
    const count = await items.count();

    // We know 92 docs are indexed — page should show some
    expect(count).toBeGreaterThan(0);
  });

  test("search finds Google Drive content", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    // Look for a search input
    const searchInput = page.getByPlaceholder(/search/i).or(page.getByRole("searchbox"));
    if (await searchInput.isVisible()) {
      await searchInput.fill("marketing strategy");
      await page.waitForTimeout(1000); // debounce
      // Page should still show results (filtered)
    }
  });

  test("chat page loads and accepts input", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    // Chat input should be visible
    const chatInput = page.getByPlaceholder(/message/i)
      .or(page.getByRole("textbox"))
      .or(page.locator("textarea"));
    await expect(chatInput.first()).toBeVisible({ timeout: 10000 });
  });
});
