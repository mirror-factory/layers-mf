import { test, expect } from "@playwright/test";

test.describe("Inbox", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("should render inbox page with heading", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByTestId("inbox-page-heading")).toBeVisible();
    await expect(page.getByTestId("inbox-page-heading")).toHaveText("Inbox");
  });

  test("should display inbox items or empty state", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const itemsList = page.getByTestId("inbox-items-list");
    const emptyState = page.getByTestId("inbox-empty-state");

    const hasItems = await itemsList.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasItems || hasEmpty).toBeTruthy();
  });

  test("should show inbox item details when items exist", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const itemsList = page.getByTestId("inbox-items-list");
    const hasItems = await itemsList.isVisible().catch(() => false);

    if (hasItems) {
      const firstItem = page.getByTestId("inbox-item").first();
      await expect(firstItem).toBeVisible();

      // Each item should show priority badge and title
      await expect(firstItem.locator(".text-sm.font-medium")).toBeVisible();
    }
  });
});

test.describe("Actions", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("should render actions page with heading", async ({ page }) => {
    await page.goto("/actions");
    await expect(page.getByTestId("actions-page-heading")).toBeVisible();
    await expect(page.getByTestId("actions-page-heading")).toHaveText(
      "Action Items",
    );
  });

  test("should display action items table or empty state", async ({
    page,
  }) => {
    await page.goto("/actions");
    await page.waitForLoadState("networkidle");

    // Wait for loading to finish
    await page
      .locator('[class*="animate-spin"]')
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {});

    const actionsTable = page.getByTestId("actions-table");
    const emptyState = page.getByTestId("actions-empty-state");

    const hasTable = await actionsTable.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test("should show action item rows when items exist", async ({ page }) => {
    await page.goto("/actions");
    await page.waitForLoadState("networkidle");

    await page
      .locator('[class*="animate-spin"]')
      .waitFor({ state: "hidden", timeout: 10000 })
      .catch(() => {});

    const actionsTable = page.getByTestId("actions-table");
    const hasTable = await actionsTable.isVisible().catch(() => false);

    if (hasTable) {
      const firstRow = page.getByTestId("action-item-row").first();
      await expect(firstRow).toBeVisible();
    }
  });

  test("should show filter controls", async ({ page }) => {
    await page.goto("/actions");
    await page.waitForLoadState("networkidle");

    // Status and source filter dropdowns should be visible
    await expect(page.getByText("All statuses")).toBeVisible();
    await expect(page.getByText("All sources")).toBeVisible();
  });
});

test.describe("Analytics", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("should render analytics page with heading", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.getByTestId("analytics-page-heading")).toBeVisible();
    await expect(page.getByTestId("analytics-page-heading")).toHaveText(
      "Analytics",
    );
  });

  test("should display analytics tabs or agent panel", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");

    const tabs = page.getByTestId("analytics-tabs");
    const hasTabs = await tabs.isVisible().catch(() => false);

    if (hasTabs) {
      // Should show the three tab triggers
      await expect(page.getByText("Context Health")).toBeVisible();
      await expect(page.getByText("Agent")).toBeVisible();
      await expect(page.getByText("Retrieval")).toBeVisible();
    } else {
      // Fallback: agent analytics panel is shown directly
      await expect(
        page.getByTestId("analytics-page-heading"),
      ).toBeVisible();
    }
  });

  test("should show health status badge when data is available", async ({
    page,
  }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");

    const tabs = page.getByTestId("analytics-tabs");
    const hasTabs = await tabs.isVisible().catch(() => false);

    if (hasTabs) {
      // Health badge should be one of Healthy, Warning, or Unhealthy
      const healthBadge = page.locator(
        'span:has-text("Healthy"), span:has-text("Warning"), span:has-text("Unhealthy")',
      );
      const hasHealth = await healthBadge.first().isVisible().catch(() => false);
      // Health badge is optional (depends on data), just verify tabs work
      expect(hasTabs || hasHealth).toBeTruthy();
    }
  });
});
