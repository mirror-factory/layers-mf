import { test, expect } from "@playwright/test";

const TEST_EMAIL = "e2e-test@layers.test";
const TEST_PASSWORD = "E2eTest2026secure";

/**
 * Canvas E2E tests
 *
 * Unauthenticated tests verify redirect behavior.
 * Authenticated tests verify canvas list, creation dialog, and workspace.
 */

test.describe("Canvas (unauthenticated)", () => {
  test("redirects to login", async ({ page }) => {
    await page.goto("/canvas");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("Canvas (authenticated)", () => {
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

  test("canvas list page loads", async ({ page }) => {
    await page.goto("/canvas");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /canvas/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("canvas page shows description text", async ({ page }) => {
    await page.goto("/canvas");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(/visually explore and connect/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("can open new canvas dialog", async ({ page }) => {
    await page.goto("/canvas");
    await page.waitForLoadState("networkidle");

    const newCanvasBtn = page.getByRole("button", { name: /new canvas/i });
    await expect(newCanvasBtn).toBeVisible({ timeout: 10000 });
    await newCanvasBtn.click();

    // Dialog should appear with "Create Canvas" title
    await expect(page.getByText(/create canvas/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("canvas page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/canvas");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });
});
