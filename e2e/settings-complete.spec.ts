import { test, expect } from "@playwright/test";

const TEST_EMAIL = "e2e-test@layers.test";
const TEST_PASSWORD = "E2eTest2026secure";

/**
 * Settings Complete E2E tests
 *
 * Tests for org settings, API keys, user guide, and issue tracker pages.
 * Unauthenticated tests verify redirect behavior.
 * Authenticated tests verify page structure and interactive elements.
 */

// ── Unauthenticated Redirects ─────────────────────────────────────────

test.describe("Org settings (unauthenticated)", () => {
  test("redirects to login", async ({ page }) => {
    await page.goto("/settings/org");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("API keys (unauthenticated)", () => {
  test("redirects to login", async ({ page }) => {
    await page.goto("/settings/api-keys");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("Guide (unauthenticated)", () => {
  test("redirects to login", async ({ page }) => {
    await page.goto("/guide");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("Issue tracker (unauthenticated)", () => {
  test("redirects to login", async ({ page }) => {
    await page.goto("/issues");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

// ── Authenticated Tests ───────────────────────────────────────────────

test.describe("Settings pages (authenticated)", () => {
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

  // ── Org Settings ────────────────────────────────────────────────────

  test("org settings page loads", async ({ page }) => {
    await page.goto("/settings/org");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: /organization/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("org settings shows description", async ({ page }) => {
    await page.goto("/settings/org");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(/manage your organization/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("org settings page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/settings/org");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });

  // ── API Keys ────────────────────────────────────────────────────────

  test("api keys page loads", async ({ page }) => {
    await page.goto("/settings/api-keys");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: /api keys/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("api keys page has generate key button", async ({ page }) => {
    await page.goto("/settings/api-keys");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("button", { name: /generate key/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("clicking generate key shows name input", async ({ page }) => {
    await page.goto("/settings/api-keys");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /generate key/i }).click();

    // Should show the key name input and Create/Cancel buttons
    await expect(page.getByLabel(/key name/i)).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: /^create$/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /cancel/i })
    ).toBeVisible();
  });

  test("api keys page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/settings/api-keys");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });

  // ── Guide ───────────────────────────────────────────────────────────

  test("guide page loads with heading", async ({ page }) => {
    await page.goto("/guide");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: /user guide/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("guide page has Getting Started section", async ({ page }) => {
    await page.goto("/guide");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/getting started/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("guide page has Features Guide section", async ({ page }) => {
    await page.goto("/guide");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/features guide/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("guide page shows getting started steps", async ({ page }) => {
    await page.goto("/guide");
    await page.waitForLoadState("networkidle");

    // Verify the 4 getting started steps
    await expect(
      page.getByText(/sign up and create your organization/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/connect your first integration/i)
    ).toBeVisible();
    await expect(
      page.getByText(/upload your first document/i)
    ).toBeVisible();
    await expect(
      page.getByText(/ask your first question in chat/i)
    ).toBeVisible();
  });

  test("guide page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/guide");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });

  // ── Issue Tracker ───────────────────────────────────────────────────

  test("issue tracker page loads", async ({ page }) => {
    await page.goto("/issues");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: /issue tracker/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("issue tracker shows sprint sections", async ({ page }) => {
    await page.goto("/issues");
    await page.waitForLoadState("networkidle");

    // Should show sprint cards
    await expect(
      page.getByText(/sprint 1/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("issue tracker shows summary stats", async ({ page }) => {
    await page.goto("/issues");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Total Issues")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Done").first()).toBeVisible();
  });

  test("issue tracker page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/issues");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });
});
