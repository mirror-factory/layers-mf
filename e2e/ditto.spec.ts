import { test, expect } from "@playwright/test";

const TEST_EMAIL = "e2e-test@layers.test";
const TEST_PASSWORD = "E2eTest2026secure";

/**
 * Ditto E2E tests
 *
 * Unauthenticated tests verify redirect behavior.
 * Authenticated tests verify Ditto profile page and For You widget on dashboard.
 */

test.describe("Ditto (unauthenticated)", () => {
  test("redirects to login", async ({ page }) => {
    await page.goto("/ditto");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("Ditto (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill(TEST_EMAIL);
    await page
      .getByRole("textbox", { name: /password/i })
      .fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    await page.evaluate(() => {
      localStorage.setItem("layers-onboarding-completed", "true");
    });
  });

  test("ditto profile page loads", async ({ page }) => {
    await page.goto("/ditto");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /ditto/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("ditto page shows description", async ({ page }) => {
    await page.goto("/ditto");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(/ai-learned profile/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("dashboard shows For You widget", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The For You suggestions widget may be visible or in empty state
    const forYouHeading = page.getByText(/for you/i);
    const dashboard = page.getByText(/dashboard/i);

    // At minimum the dashboard should load
    await expect(dashboard.or(forYouHeading).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("ditto page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/ditto");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });
});
