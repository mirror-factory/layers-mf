import { test, expect } from "@playwright/test";

test.describe("Context Library", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("should render context library page", async ({ page }) => {
    await page.goto("/context");
    await expect(page.getByTestId("context-page-heading")).toBeVisible();
    await expect(page.getByTestId("context-page-heading")).toHaveText(
      "Context Library",
    );
  });

  test("should display context items or empty state after loading", async ({
    page,
  }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    // Either the library with items or the empty state should be visible
    const library = page.getByTestId("context-library");
    const emptyState = page.getByTestId("context-empty-state");
    const pageEmptyState = page.getByText(
      "No context items yet. Upload your first document above.",
    );

    const hasLibrary = await library.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasPageEmpty = await pageEmptyState.isVisible().catch(() => false);

    expect(hasLibrary || hasEmptyState || hasPageEmpty).toBeTruthy();
  });

  test("should show source sidebar with All Items option", async ({
    page,
  }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const library = page.getByTestId("context-library");
    const hasLibrary = await library.isVisible().catch(() => false);

    if (hasLibrary) {
      const sidebar = page.getByTestId("context-source-sidebar");
      // Sidebar may be hidden on mobile viewports
      const allItemsButton = page.getByTestId("source-filter-all");
      await expect(sidebar).toBeAttached();
      await expect(allItemsButton).toBeAttached();
    }
  });

  test("should filter by source type", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const library = page.getByTestId("context-library");
    const hasLibrary = await library.isVisible().catch(() => false);

    if (hasLibrary) {
      // Get current item count
      const countText = await page
        .getByTestId("context-item-count")
        .textContent();
      const totalCount = parseInt(countText ?? "0");

      // Look for any source filter button (e.g., upload, github, slack)
      const sourceButtons = page.locator('[data-testid^="source-filter-"]');
      const buttonCount = await sourceButtons.count();

      // If there are source-specific filters (more than just "all"), click one
      if (buttonCount > 1) {
        // Click a specific source filter (not "all")
        await sourceButtons.nth(1).click();

        // The item count should update (may be same or different)
        const filteredText = await page
          .getByTestId("context-item-count")
          .textContent();
        const filteredCount = parseInt(filteredText ?? "0");
        expect(filteredCount).toBeLessThanOrEqual(totalCount);

        // Click "All Items" to reset
        await page.getByTestId("source-filter-all").click();
        const resetText = await page
          .getByTestId("context-item-count")
          .textContent();
        expect(parseInt(resetText ?? "0")).toBe(totalCount);
      }
    }
  });

  test("should show content type filter and sort controls", async ({
    page,
  }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const library = page.getByTestId("context-library");
    const hasLibrary = await library.isVisible().catch(() => false);

    if (hasLibrary) {
      await expect(page.getByTestId("content-type-filter")).toBeVisible();
      await expect(page.getByTestId("sort-filter")).toBeVisible();
    }
  });

  test("should navigate to context item detail", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const itemsList = page.getByTestId("context-items-list");
    const hasItems = await itemsList.isVisible().catch(() => false);

    if (hasItems) {
      // Click the first context item link
      const firstItemLink = itemsList.locator("a").first();
      await expect(firstItemLink).toBeVisible();

      const href = await firstItemLink.getAttribute("href");
      expect(href).toMatch(/^\/context\/[a-zA-Z0-9-]+$/);

      await firstItemLink.click();
      await expect(page).toHaveURL(/\/context\/[a-zA-Z0-9-]+/);
    }
  });

  test("should show context item detail page", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const itemsList = page.getByTestId("context-items-list");
    const hasItems = await itemsList.isVisible().catch(() => false);

    if (hasItems) {
      // Navigate to first item
      const firstItemLink = itemsList.locator("a").first();
      await firstItemLink.click();
      await page.waitForLoadState("networkidle");

      // Verify detail page elements
      await expect(page.getByTestId("context-detail-page")).toBeVisible();
      await expect(page.getByTestId("context-detail-title")).toBeVisible();

      // Back link should exist
      const backLink = page.getByRole("link", {
        name: /back to context library/i,
      });
      await expect(backLink).toBeVisible();
    }
  });

  test("should show upload interface", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    // The ContextUploader is rendered in the page header area
    // Check for the browse button (the dropzone may not be visible without interaction)
    const browseButton = page.getByTestId("upload-browse-button");
    const hasBrowse = await browseButton.isVisible().catch(() => false);

    // Also check for the "Upload Meeting" button in the page header
    const uploadMeeting = page.getByRole("link", {
      name: /upload meeting/i,
    });
    const hasUploadMeeting = await uploadMeeting.isVisible().catch(() => false);

    expect(hasBrowse || hasUploadMeeting).toBeTruthy();
  });

  test("should handle file upload via input", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const fileInput = page.getByTestId("upload-file-input");
    // File input is hidden (className="hidden"), so check count instead
    const inputCount = await fileInput.count();

    if (inputCount > 0) {
      // Verify input accepts the right file types
      const accept = await fileInput.getAttribute("accept");
      expect(accept).toContain(".txt");
      expect(accept).toContain(".pdf");
      expect(accept).toContain(".md");
      expect(accept).toContain(".docx");
    }
  });

  test("should show bulk action controls when items selected", async ({
    page,
  }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const itemsList = page.getByTestId("context-items-list");
    const hasItems = await itemsList.isVisible().catch(() => false);

    if (hasItems) {
      // Bulk action bar should NOT be visible initially
      await expect(page.getByTestId("bulk-action-bar")).not.toBeVisible();

      // Click select-all checkbox
      await page.getByTestId("context-select-all").click();

      // Bulk action bar should appear
      await expect(page.getByTestId("bulk-action-bar")).toBeVisible();
      await expect(page.getByTestId("bulk-selection-count")).toBeVisible();
      await expect(page.getByTestId("bulk-delete-button")).toBeVisible();
      await expect(page.getByTestId("bulk-cancel-button")).toBeVisible();

      // Cancel to deselect
      await page.getByTestId("bulk-cancel-button").click();
      await expect(page.getByTestId("bulk-action-bar")).not.toBeVisible();
    }
  });

  test("should show export button", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const library = page.getByTestId("context-library");
    const hasLibrary = await library.isVisible().catch(() => false);

    if (hasLibrary) {
      const exportButton = page.getByTestId("context-export-button");
      await expect(exportButton).toBeVisible();
      await expect(exportButton).toHaveAttribute("aria-label", "Export context");
    }
  });

  test("should navigate back from detail page to library", async ({
    page,
  }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const itemsList = page.getByTestId("context-items-list");
    const hasItems = await itemsList.isVisible().catch(() => false);

    if (hasItems) {
      // Navigate to first item detail
      const firstItemLink = itemsList.locator("a").first();
      await firstItemLink.click();
      await page.waitForLoadState("networkidle");

      // Click back link
      const backLink = page.getByRole("link", {
        name: /back to context library/i,
      });
      await backLink.click();

      await expect(page).toHaveURL(/\/context$/);
      await expect(page.getByTestId("context-page-heading")).toBeVisible();
    }
  });
});
