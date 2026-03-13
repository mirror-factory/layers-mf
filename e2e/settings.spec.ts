import { test, expect } from "@playwright/test";

/**
 * Settings E2E tests (PROD-200)
 *
 * These tests verify settings pages render correctly when unauthenticated
 * (redirect to login) and validate page structure via data-testid attributes.
 * When auth fixtures are available, the authenticated tests can be enabled.
 */

test.describe("Settings pages (unauthenticated)", () => {
  test("profile settings redirects to login", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("team settings redirects to login", async ({ page }) => {
    await page.goto("/settings/team");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("audit log redirects to login", async ({ page }) => {
    await page.goto("/settings/audit");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

/**
 * Authenticated settings tests.
 *
 * These require E2E auth setup (storageState or login fixture).
 * Mark as fixme until auth fixture is wired up so they are skipped
 * but visible in the test report.
 */
test.describe("Settings pages (authenticated)", () => {
  // Skip until auth fixture is configured
  test.skip();

  // ── Profile ───────────────────────────────────────────────────────────

  test("profile page renders with form fields", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page.getByTestId("profile-settings")).toBeVisible();
    await expect(page.getByTestId("profile-email")).toBeVisible();
    await expect(page.getByTestId("profile-display-name")).toBeVisible();
    await expect(page.getByTestId("profile-save-btn")).toBeVisible();
  });

  test("profile display name field is editable", async ({ page }) => {
    await page.goto("/settings/profile");
    const nameInput = page.getByTestId("profile-display-name");
    await nameInput.click();
    await nameInput.fill("Test User");
    await expect(nameInput).toHaveValue("Test User");
  });

  test("profile page shows password change form", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page.getByLabel(/new password/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /change password/i })
    ).toBeVisible();
  });

  // ── Team ──────────────────────────────────────────────────────────────

  test("team page renders with member list", async ({ page }) => {
    await page.goto("/settings/team");
    await expect(page.getByTestId("team-management")).toBeVisible();
    await expect(page.getByText("Members")).toBeVisible();
  });

  test("team invite button is visible for owners", async ({ page }) => {
    await page.goto("/settings/team");
    await expect(page.getByTestId("invite-btn")).toBeVisible();
  });

  // ── Audit Log ─────────────────────────────────────────────────────────

  test("audit log page renders", async ({ page }) => {
    await page.goto("/settings/audit");
    await expect(page.getByTestId("audit-page")).toBeVisible();
    await expect(page.getByText("Audit Log")).toBeVisible();
  });

  test("audit log shows empty state or table", async ({ page }) => {
    await page.goto("/settings/audit");
    const table = page.getByTestId("audit-table");
    const emptyState = page.getByText("No audit entries yet");
    // One of the two should be visible
    await expect(table.or(emptyState).first()).toBeVisible();
  });
});
