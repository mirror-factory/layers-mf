import { test, expect } from "@playwright/test";

/**
 * Dashboard tests — these test unauthenticated redirects.
 * When auth setup is configured with credentials, these can be extended
 * to test authenticated flows.
 */
test.describe("Dashboard (unauthenticated)", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/");
    // Should redirect to /login since user is not authenticated
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("chat page redirects to login", async ({ page }) => {
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("context library redirects to login", async ({ page }) => {
    await page.goto("/context");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("inbox redirects to login", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("integrations redirects to login", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("sessions redirects to login", async ({ page }) => {
    await page.goto("/sessions");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("settings redirects to login", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
