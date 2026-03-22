import { test, expect } from "@playwright/test";

/**
 * Marketing pages E2E tests
 *
 * These pages are publicly accessible without authentication.
 * Tests verify landing page, pricing page, and features page render correctly.
 */

test.describe("Marketing Pages", () => {
  // ── Landing Page ────────────────────────────────────────────────────

  test("landing page loads for unauthenticated users", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);

    // Should show the hero heading
    await expect(
      page.getByText(/the operating system for/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/ai-native teams/i)).toBeVisible();
  });

  test("landing page shows Get Started CTA", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("link", { name: /get started free/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("landing page shows feature highlights", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Connect Everything")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Search Across Tools")).toBeVisible();
    await expect(
      page.getByText("AI That Understands Context")
    ).toBeVisible();
    await expect(page.getByText("Team Knowledge Base")).toBeVisible();
  });

  test("landing page shows How it works section", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("How it works")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Connect your tools")).toBeVisible();
  });

  test("landing page shows pricing section", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("Simple, transparent pricing").first()
    ).toBeVisible({ timeout: 10000 });

    // Plan names
    await expect(page.getByText("Free").first()).toBeVisible();
    await expect(page.getByText("Starter").first()).toBeVisible();
    await expect(page.getByText("Pro").first()).toBeVisible();
  });

  test("landing page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });

  // ── Pricing Page ────────────────────────────────────────────────────

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", {
        name: /simple, transparent pricing/i,
      })
    ).toBeVisible({ timeout: 10000 });
  });

  test("pricing page shows plan cards", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    // Three plan cards with prices
    await expect(page.getByText("$0").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("$19").first()).toBeVisible();
    await expect(page.getByText("$49").first()).toBeVisible();
  });

  test("pricing page shows feature comparison table", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Feature comparison")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Credits per month")).toBeVisible();
  });

  test("pricing page shows FAQ section", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("Frequently asked questions")
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("What are credits?")).toBeVisible();
  });

  test("pricing page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });

  // ── Features Page ───────────────────────────────────────────────────

  test("features page loads without auth", async ({ page }) => {
    const response = await page.goto("/features");
    expect(response?.status()).toBeLessThan(500);

    // Should not redirect to login
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toMatch(/\/login/);
  });

  test("features page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/features");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });
});
