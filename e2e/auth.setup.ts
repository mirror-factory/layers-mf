import { test as setup, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "alfonso@roiamplified.com";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";

/**
 * Authenticate and save session state for reuse in dashboard tests.
 * Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars.
 */
setup("authenticate", async ({ page }) => {
  setup.skip(!TEST_PASSWORD, "E2E_TEST_PASSWORD not set — skipping auth setup");

  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/^\/$|\/chat|\/context|\/inbox/, { timeout: 15000 });

  // Save auth state
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
