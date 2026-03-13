import { test, expect } from "@playwright/test";

test.describe("Integrations Page", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("should render integrations page with heading", async ({ page }) => {
    await page.goto("/integrations");
    await page.waitForLoadState("networkidle");

    const heading = page.getByTestId("integrations-heading");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Integrations");

    // Verify page description
    await expect(
      page.getByText(
        "Connect your tools so Layers can sync meetings, issues, and documents automatically."
      )
    ).toBeVisible();
  });

  test("should display connect panel with connect button", async ({
    page,
  }) => {
    await page.goto("/integrations");
    await page.waitForLoadState("networkidle");

    const connectPanel = page.getByTestId("connect-panel");
    await expect(connectPanel).toBeVisible();

    const connectButton = page.getByTestId("connect-button");
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toHaveText("Connect");
    await expect(connectButton).toBeEnabled();
  });

  test("should show integrations count", async ({ page }) => {
    await page.goto("/integrations");
    await page.waitForLoadState("networkidle");

    const countText = page.getByTestId("integrations-count");
    await expect(countText).toBeVisible();
    // Should show "N integration(s) connected"
    await expect(countText).toHaveText(/\d+ integrations? connected/);
  });

  test("should display integration cards or empty state", async ({ page }) => {
    await page.goto("/integrations");
    await page.waitForLoadState("networkidle");

    const list = page.getByTestId("integrations-list");
    const empty = page.getByTestId("integrations-empty");

    // Either integration cards are shown or the empty state is visible
    const hasIntegrations = (await list.count()) > 0;
    const hasEmptyState = (await empty.count()) > 0;

    expect(hasIntegrations || hasEmptyState).toBe(true);

    if (hasEmptyState) {
      await expect(
        page.getByText("No integrations connected")
      ).toBeVisible();
      await expect(
        page.getByText(
          "Connect your tools to sync knowledge into Layers automatically."
        )
      ).toBeVisible();
    }
  });

  test("should show connected status badge for active integrations", async ({
    page,
  }) => {
    await page.goto("/integrations");
    await page.waitForLoadState("networkidle");

    const list = page.getByTestId("integrations-list");
    if ((await list.count()) === 0) {
      test.skip();
      return;
    }

    // At least one integration card should exist
    const cards = page.locator('[data-testid^="integration-card-"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Each card should have a status badge
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const statusBadge = card.locator('[data-testid^="integration-status-"]');
      await expect(statusBadge).toBeVisible();
      // Status should be one of: Connected, Paused, Error
      await expect(statusBadge).toHaveText(/Connected|Paused|Error/);
    }
  });

  test("should show sync button for connected integrations", async ({
    page,
  }) => {
    await page.goto("/integrations");
    await page.waitForLoadState("networkidle");

    const list = page.getByTestId("integrations-list");
    if ((await list.count()) === 0) {
      test.skip();
      return;
    }

    // Each integration card should have a sync button
    const syncButtons = page.locator('[data-testid^="sync-button-"]');
    const buttonCount = await syncButtons.count();
    expect(buttonCount).toBeGreaterThan(0);

    for (let i = 0; i < buttonCount; i++) {
      const button = syncButtons.nth(i);
      await expect(button).toBeVisible();
      await expect(button).toHaveText("Sync");
      await expect(button).toBeEnabled();
    }
  });

  test("should show disconnect button for connected integrations", async ({
    page,
  }) => {
    await page.goto("/integrations");
    await page.waitForLoadState("networkidle");

    const list = page.getByTestId("integrations-list");
    if ((await list.count()) === 0) {
      test.skip();
      return;
    }

    const disconnectButtons = page.locator(
      '[data-testid^="disconnect-button-"]'
    );
    const buttonCount = await disconnectButtons.count();
    expect(buttonCount).toBeGreaterThan(0);

    for (let i = 0; i < buttonCount; i++) {
      await expect(disconnectButtons.nth(i)).toBeVisible();
    }
  });

  test("should show provider details on integration cards", async ({
    page,
  }) => {
    await page.goto("/integrations");
    await page.waitForLoadState("networkidle");

    const list = page.getByTestId("integrations-list");
    if ((await list.count()) === 0) {
      test.skip();
      return;
    }

    const cards = page.locator('[data-testid^="integration-card-"]');
    const cardCount = await cards.count();

    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      // Each card should show provider label (e.g., GitHub, Slack, Linear)
      const providerLabel = card.locator(".text-sm.font-medium").first();
      await expect(providerLabel).toBeVisible();
      const labelText = await providerLabel.textContent();
      expect(labelText).toBeTruthy();

      // Each card should show a description
      const description = card
        .locator(".text-xs.text-muted-foreground")
        .first();
      await expect(description).toBeVisible();
    }
  });
});
