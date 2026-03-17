import { test, expect } from "@playwright/test";

const TEST_EMAIL = "e2e-test@layers.test";
const TEST_PASSWORD = "E2eTest2026secure";

/**
 * Production smoke tests (PROD-S4-15)
 *
 * Verifies all pages render without JS errors and key UI elements
 * are present. Covers analytics health, context detail, and the
 * full set of new pages added in Sprint 4.
 */

test.describe("Production smoke — unauthenticated redirects", () => {
  const protectedPages = [
    { path: "/settings/billing", name: "Billing" },
    { path: "/settings/source-trust", name: "Source Trust" },
    { path: "/settings/notifications", name: "Notifications" },
    { path: "/analytics/health", name: "Analytics Health" },
    { path: "/features", name: "Features" },
  ];

  for (const { path, name } of protectedPages) {
    test(`${name} (${path}) redirects to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });
  }
});

test.describe("Production smoke — authenticated", () => {
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

  // ── Analytics Health ──────────────────────────────────────────────────

  test("analytics health dashboard loads", async ({ page }) => {
    await page.goto("/analytics/health");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/health/i)).toBeVisible({ timeout: 10000 });
  });

  test("analytics health shows score or metrics", async ({ page }) => {
    await page.goto("/analytics/health");
    await page.waitForLoadState("networkidle");

    // Should have some kind of score display, chart, or metric cards
    const scoreEl = page
      .getByText(/health score/i)
      .or(page.getByText(/score/i))
      .or(page.locator("[data-testid='health-score']"));
    await expect(scoreEl.first()).toBeVisible({ timeout: 10000 });
  });

  // ── Context Detail & Version History ──────────────────────────────────

  test("context detail page loads for first item", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    // Find a clickable context item (link or row)
    const firstItem = page
      .locator('[data-testid="context-item"]')
      .or(page.locator("table tbody tr"))
      .or(page.locator("[class*='card']"))
      .first();

    if (await firstItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstItem.click();
      await page.waitForLoadState("networkidle");

      // Should navigate to a context detail URL (/context/[id])
      expect(page.url()).toMatch(/\/context\/[a-zA-Z0-9-]+/);
    }
  });

  test("context detail shows version history section", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const firstItem = page
      .locator('[data-testid="context-item"]')
      .or(page.locator("table tbody tr"))
      .or(page.locator("[class*='card']"))
      .first();

    if (await firstItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstItem.click();
      await page.waitForLoadState("networkidle");

      // Check version history section exists
      const versionSection = page
        .getByText(/version/i)
        .or(page.getByText(/history/i))
        .or(page.locator("[data-testid='version-history']"));
      await expect(versionSection.first()).toBeVisible({ timeout: 10000 });
    }
  });

  // ── Full page smoke — no JS errors ────────────────────────────────────

  const smokePages = [
    { path: "/", name: "Dashboard Home" },
    { path: "/chat", name: "Chat" },
    { path: "/context", name: "Context Library" },
    { path: "/sessions", name: "Sessions" },
    { path: "/inbox", name: "Inbox" },
    { path: "/actions", name: "Actions" },
    { path: "/analytics", name: "Analytics" },
    { path: "/analytics/health", name: "Analytics Health" },
    { path: "/integrations", name: "Integrations" },
    { path: "/settings/profile", name: "Profile Settings" },
    { path: "/settings/team", name: "Team Settings" },
    { path: "/settings/billing", name: "Billing Settings" },
    { path: "/settings/source-trust", name: "Source Trust Settings" },
    { path: "/settings/notifications", name: "Notification Settings" },
    { path: "/settings/audit", name: "Audit Log" },
    { path: "/features", name: "Features" },
    { path: "/api-docs", name: "API Docs" },
  ];

  for (const { path, name } of smokePages) {
    test(`${name} renders without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Filter out benign ResizeObserver warnings
      const realErrors = errors.filter(
        (e) => !e.includes("ResizeObserver")
      );
      expect(realErrors).toHaveLength(0);
    });
  }
});
