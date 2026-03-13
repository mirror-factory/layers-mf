import { test, expect } from "@playwright/test";

test.describe("Sessions", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("should render sessions page with heading", async ({ page }) => {
    await page.goto("/sessions");
    await expect(page.getByTestId("sessions-page-heading")).toBeVisible();
    await expect(page.getByTestId("sessions-page-heading")).toHaveText(
      "Sessions",
    );
  });

  test("should display session list or empty state", async ({ page }) => {
    await page.goto("/sessions");
    await page.waitForLoadState("networkidle");

    const sessionsList = page.getByTestId("sessions-list");
    const emptyState = page.getByTestId("sessions-empty-state");

    const hasList = await sessionsList.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("should show create session button", async ({ page }) => {
    await page.goto("/sessions");
    await page.waitForLoadState("networkidle");

    const createButton = page.getByTestId("create-session-button");
    // There may be two (header + empty state), at least one should be visible
    await expect(createButton.first()).toBeVisible();
  });

  test("should open create session dialog", async ({ page }) => {
    await page.goto("/sessions");
    await page.waitForLoadState("networkidle");

    const createButton = page.getByTestId("create-session-button");
    await createButton.first().click();

    await expect(page.getByTestId("create-session-dialog")).toBeVisible();
    await expect(page.getByText("Create Session")).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Goal")).toBeVisible();
  });

  test("should navigate to session workspace when clicking a session item", async ({
    page,
  }) => {
    await page.goto("/sessions");
    await page.waitForLoadState("networkidle");

    const sessionsList = page.getByTestId("sessions-list");
    const hasList = await sessionsList.isVisible().catch(() => false);

    if (hasList) {
      const firstItem = page.getByTestId("session-item").first();
      await expect(firstItem).toBeVisible();

      const href = await firstItem.getAttribute("href");
      expect(href).toMatch(/^\/sessions\/[a-zA-Z0-9-]+$/);

      await firstItem.click();
      await expect(page).toHaveURL(/\/sessions\/[a-zA-Z0-9-]+/);
    }
  });

  test("should render session workspace with context panel", async ({
    page,
  }) => {
    await page.goto("/sessions");
    await page.waitForLoadState("networkidle");

    const sessionsList = page.getByTestId("sessions-list");
    const hasList = await sessionsList.isVisible().catch(() => false);

    if (hasList) {
      const firstItem = page.getByTestId("session-item").first();
      await firstItem.click();
      await page.waitForLoadState("networkidle");

      await expect(page.getByTestId("session-workspace")).toBeVisible();
      await expect(page.getByTestId("add-context-button")).toBeVisible();
    }
  });
});
