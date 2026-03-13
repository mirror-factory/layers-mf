import { test, expect } from "@playwright/test";

/**
 * Dashboard tests — unauthenticated redirect checks.
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

/**
 * Dashboard smoke tests — all 12 pages render without JS errors.
 *
 * These require auth. Skipped until auth fixture is wired up.
 */
test.describe("Dashboard smoke tests (all pages)", () => {
  test.skip();

  const pages = [
    { path: "/", name: "Dashboard Home" },
    { path: "/chat", name: "Chat" },
    { path: "/context", name: "Context Library" },
    { path: "/sessions", name: "Sessions" },
    { path: "/inbox", name: "Inbox" },
    { path: "/actions", name: "Actions" },
    { path: "/analytics", name: "Analytics" },
    { path: "/integrations", name: "Integrations" },
    { path: "/settings/profile", name: "Profile Settings" },
    { path: "/settings/team", name: "Team Settings" },
    { path: "/settings/audit", name: "Audit Log" },
    { path: "/api-docs", name: "API Docs" },
  ];

  for (const { path, name } of pages) {
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
