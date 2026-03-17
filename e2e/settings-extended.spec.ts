import { test, expect } from "@playwright/test";

const TEST_EMAIL = "e2e-test@layers.test";
const TEST_PASSWORD = "E2eTest2026secure";

/**
 * Extended settings E2E tests (PROD-S4-14)
 *
 * Tests for source trust and notifications settings pages.
 * Unauthenticated tests verify redirect behavior.
 * Authenticated tests verify page structure and interactive elements.
 */

test.describe("Source Trust settings (unauthenticated)", () => {
  test("redirects to login", async ({ page }) => {
    await page.goto("/settings/source-trust");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("Notifications settings (unauthenticated)", () => {
  test("redirects to login", async ({ page }) => {
    await page.goto("/settings/notifications");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("Extended settings (authenticated)", () => {
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

  // ── Source Trust ──────────────────────────────────────────────────────

  test("source trust page loads", async ({ page }) => {
    await page.goto("/settings/source-trust");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/source trust/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("source trust page has slider controls", async ({ page }) => {
    await page.goto("/settings/source-trust");
    await page.waitForLoadState("networkidle");

    // Look for slider elements (range inputs or role=slider)
    const sliders = page
      .locator('[role="slider"]')
      .or(page.locator('input[type="range"]'));
    const count = await sliders.count();
    expect(count).toBeGreaterThan(0);
  });

  test("source trust page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/settings/source-trust");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });

  // ── Notifications ────────────────────────────────────────────────────

  test("notifications page loads", async ({ page }) => {
    await page.goto("/settings/notifications");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/notification/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("notifications page has toggle switches", async ({ page }) => {
    await page.goto("/settings/notifications");
    await page.waitForLoadState("networkidle");

    // Look for toggle switches (role=switch or checkbox-style toggles)
    const toggles = page
      .locator('[role="switch"]')
      .or(page.locator('button[aria-checked]'))
      .or(page.locator('input[type="checkbox"]'));
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);
  });

  test("notifications page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/settings/notifications");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });
});
