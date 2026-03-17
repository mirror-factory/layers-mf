import { test, expect } from "@playwright/test";

const TEST_EMAIL = "e2e-test@layers.test";
const TEST_PASSWORD = "E2eTest2026secure";

/**
 * Billing E2E tests (PROD-S4-14)
 *
 * Unauthenticated tests verify redirect behavior.
 * Authenticated tests verify billing page structure, credit packages,
 * usage history, and sidebar navigation.
 */

test.describe("Billing (unauthenticated)", () => {
  test("billing page redirects to login", async ({ page }) => {
    await page.goto("/settings/billing");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("Billing (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill(TEST_EMAIL);
    await page
      .getByRole("textbox", { name: /password/i })
      .fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Skip onboarding
    await page.evaluate(() => {
      localStorage.setItem("layers-onboarding-completed", "true");
    });
  });

  test("displays billing settings container", async ({ page }) => {
    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("billing-settings")).toBeVisible({
      timeout: 10000,
    });
  });

  test("displays credit balance section", async ({ page }) => {
    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("billing-settings")).toBeVisible({
      timeout: 10000,
    });
    // Credit balance heading
    await expect(page.getByText("Credit Balance")).toBeVisible();
    // "credits remaining" label
    await expect(page.getByText(/credits remaining/i)).toBeVisible();
  });

  test("shows credit packages with prices", async ({ page }) => {
    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("billing-settings")).toBeVisible({
      timeout: 10000,
    });

    // Three credit packages: 100 ($9.99), 500 ($39.99), 2000 ($129.99)
    await expect(page.getByText("$9.99")).toBeVisible();
    await expect(page.getByText("$39.99")).toBeVisible();
    await expect(page.getByText("$129.99")).toBeVisible();
  });

  test("shows package labels", async ({ page }) => {
    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("billing-settings")).toBeVisible({
      timeout: 10000,
    });

    await expect(page.getByText("100 credits")).toBeVisible();
    await expect(page.getByText("500 credits")).toBeVisible();
    await expect(page.getByText("2,000 credits")).toBeVisible();
  });

  test("shows buy buttons for each package", async ({ page }) => {
    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("billing-settings")).toBeVisible({
      timeout: 10000,
    });

    const buyButtons = page.getByRole("button", { name: /buy/i });
    await expect(buyButtons).toHaveCount(3);
  });

  test("shows usage history section", async ({ page }) => {
    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");

    // Usage history section (rendered below billing settings)
    await expect(page.getByText(/usage/i)).toBeVisible({ timeout: 10000 });
  });

  test("navigates to billing from sidebar", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find billing link in sidebar navigation
    const billingLink = page.locator('a[href="/settings/billing"]').first();
    if (await billingLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await billingLink.click();
      await expect(page).toHaveURL(/\/settings\/billing/);
      await expect(page.getByTestId("billing-settings")).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("billing page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });
});
