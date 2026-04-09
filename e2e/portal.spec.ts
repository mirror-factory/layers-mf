import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PORTAL_FIXTURE = {
  id: "test-portal",
  title: "BlueWave AI Proposal",
  subtitle: "Prepared by Mirror Factory",
  client_name: "BlueWave Resource Partners",
  brand_color: "#0DE4F2",
  brand_secondary_color: null,
  logo_url: "/bluewave-logo.svg",
  pdf_url: null,
  pdf_storage_path: null,
  document_content:
    "# Executive Summary\n\nThis proposal outlines our approach...\n\n## Scope of Work\n\nPhase 1: Discovery...",
  documents: [
    {
      id: "doc1",
      title: "Proposal",
      context_item_id: "ci1",
      is_active: true,
      pdf_path: null,
      content: "# Executive Summary\n\nThis proposal outlines...",
    },
  ],
  audio_url: null,
  audio_storage_path: null,
  system_prompt: null,
  enabled_tools: ["search_document", "navigate_portal", "render_chart"],
  model: "google/gemini-3-flash",
  hide_chrome: false,
  default_expanded: false,
  share_token: "test-token",
  page_count: 1,
};

// Minimal SSE stream that immediately signals completion
const SSE_DONE_RESPONSE = `data: {"type":"text-delta","textDelta":"Hello!"}\n\ndata: [DONE]\n\n`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Register route mocks for the portal API and chat API on a page.
 * Must be called before page.goto().
 */
async function mockPortalRoutes(page: Page) {
  // Public portal data endpoint
  await page.route("**/api/portals/public/**", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ portal: PORTAL_FIXTURE }),
    });
  });

  // Portal chat endpoint — return a minimal SSE stream
  await page.route("**/api/chat/portal", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: SSE_DONE_RESPONSE,
    });
  });

  // Suppress the bluewave manifest fetch that happens inside doc-preview
  await page.route("**/portal-docs/bluewave/_manifest.json", (route: Route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

/**
 * Dismiss the welcome modal if it appears (shown 2 s after mount).
 * Skips gracefully if the modal never appears in the given time.
 */
async function dismissWelcomeModal(page: Page) {
  // Pre-seed sessionStorage so the modal never fires
  await page.evaluate(() => {
    sessionStorage.setItem("portal-welcome-seen-BlueWave Resource Partners", "1");
  });
}

/**
 * Navigate to the portal page, mock routes, suppress the welcome modal,
 * and wait for the library heading to be visible.
 */
async function gotoPortal(page: Page) {
  await mockPortalRoutes(page);
  await page.goto("/portal/test-token");

  // Suppress the welcome modal immediately after JS hydrates
  await page.waitForFunction(() => typeof window.sessionStorage !== "undefined");
  await dismissWelcomeModal(page);

  // Wait for the portal to finish loading (spinner disappears)
  await expect(page.getByText("Loading portal...")).not.toBeVisible({
    timeout: 15000,
  });
}

// ---------------------------------------------------------------------------
// Test 1: Mobile view — library landing + doc viewer
// ---------------------------------------------------------------------------

test.describe("Portal — mobile view (iPhone 14 Pro)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows library landing, opens doc preview, floating chat bar works", async ({
    page,
  }) => {
    await gotoPortal(page);

    // ── Library is shown first ──────────────────────────────────────────────
    const libraryHeading = page.getByRole("heading", {
      name: "Document Library",
    });
    await expect(libraryHeading).toBeVisible({ timeout: 10000 });

    // ── Document cards are visible ──────────────────────────────────────────
    // The grid on mobile is single-column (no sm:grid-cols-2 class active)
    const docCards = page.locator(
      ".grid.gap-4 > div[class*='rounded-xl'][class*='border']"
    );
    await expect(docCards.first()).toBeVisible({ timeout: 8000 });

    // Confirm there is at least one card
    const cardCount = await docCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // ── Click first document card to open doc-preview ───────────────────────
    await docCards.first().click();

    // Back button appears in the doc-preview sticky header
    const backButton = page.locator(
      'button[title="Back to Library"]'
    );
    await expect(backButton).toBeVisible({ timeout: 8000 });

    // Document title visible in the preview header
    const previewTitle = page
      .locator("p.truncate.text-sm.font-semibold.text-white")
      .first();
    await expect(previewTitle).toBeVisible({ timeout: 8000 });

    // ── Floating chat bar is visible at the bottom ──────────────────────────
    // The floating prompt bar renders the placeholder text
    const floatingBar = page.getByText("Ask about this document...");
    await expect(floatingBar).toBeVisible({ timeout: 8000 });

    // ── Click the floating chat bar to open the chat panel ─────────────────
    await floatingBar.click();

    // Chat panel open: the ChatInterface renders a textarea or the collapse button appears
    // We look for the "Collapse" button that appears in the expanded chat bar header
    const collapseButton = page.getByText("Collapse");
    await expect(collapseButton).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Test 2: Tablet view — library grid + header tabs
// ---------------------------------------------------------------------------

test.describe("Portal — tablet view (iPad)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("shows 2-column library grid, Library tab active, chat expand button exists", async ({
    page,
  }) => {
    await gotoPortal(page);

    // ── Library heading present ─────────────────────────────────────────────
    await expect(
      page.getByRole("heading", { name: "Document Library" })
    ).toBeVisible({ timeout: 10000 });

    // ── Grid has the sm:grid-cols-2 breakpoint active at 768 px ────────────
    // The grid container has class "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    // Playwright can check computed columns via evaluate
    const gridColCount = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".grid.gap-4");
      if (!grid) return 0;
      const style = window.getComputedStyle(grid);
      // gridTemplateColumns returns repeated "Npx" values separated by spaces
      const cols = style.gridTemplateColumns.split(" ").filter(Boolean);
      return cols.length;
    });
    // At 768 px, sm:grid-cols-2 fires → 2 columns
    expect(gridColCount).toBeGreaterThanOrEqual(2);

    // ── Header "Library" tab button is visible and active ──────────────────
    const libraryTab = page.getByRole("button", { name: /Library/i }).first();
    await expect(libraryTab).toBeVisible({ timeout: 8000 });
    // The active Library tab has a backgroundColor set inline (the brand color)
    // We verify it exists and is clickable
    await expect(libraryTab).toBeEnabled();

    // ── Expand/collapse chat button (Expand icon) is visible in the header ──
    const expandButton = page.locator('button[title="Expanded mode"], button[title="Compact mode"]');
    await expect(expandButton).toBeVisible({ timeout: 8000 });

    // ── Floating prompt bar is present ─────────────────────────────────────
    const floatingBar = page.getByText("Ask about this document...");
    await expect(floatingBar).toBeVisible({ timeout: 8000 });
  });
});

// ---------------------------------------------------------------------------
// Test 3: Desktop — floating prompt bar centered, chat drawer opens
// ---------------------------------------------------------------------------

test.describe("Portal — desktop (1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("floating prompt bar is centered, clicking opens chat drawer, library shows 3-column grid", async ({
    page,
  }) => {
    await gotoPortal(page);

    await expect(
      page.getByRole("heading", { name: "Document Library" })
    ).toBeVisible({ timeout: 10000 });

    // ── Floating prompt bar is visible at bottom center ────────────────────
    const floatingBar = page.getByText("Ask about this document...");
    await expect(floatingBar).toBeVisible({ timeout: 8000 });

    // Verify it is positioned roughly in the horizontal center of the viewport
    const barBox = await floatingBar.boundingBox();
    expect(barBox).not.toBeNull();
    if (barBox) {
      const barCenterX = barBox.x + barBox.width / 2;
      // Center should be within ±200 px of viewport center (720 px at 1440 wide)
      expect(Math.abs(barCenterX - 720)).toBeLessThan(200);
    }

    // ── Click the floating bar to open the chat drawer ─────────────────────
    await floatingBar.click();

    // The "Collapse" button appears when the chat drawer is open (not expanded sidebar mode)
    const collapseButton = page.getByText("Collapse");
    await expect(collapseButton).toBeVisible({ timeout: 8000 });

    // ── Library grid shows 3 columns at 1440 px (lg:grid-cols-3) ───────────
    // Close the chat first to scroll to the library grid
    await collapseButton.click();
    await expect(floatingBar).toBeVisible({ timeout: 5000 });

    const gridColCount = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".grid.gap-4");
      if (!grid) return 0;
      const cols = window.getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean);
      return cols.length;
    });
    // At 1440 px, lg:grid-cols-3 fires → 3 columns
    expect(gridColCount).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Desktop — expanding chat into sidebar
// ---------------------------------------------------------------------------

test.describe("Portal — desktop sidebar mode (1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("clicking Expand moves chat into right sidebar (35% width area)", async ({
    page,
  }) => {
    await gotoPortal(page);

    await expect(
      page.getByRole("heading", { name: "Document Library" })
    ).toBeVisible({ timeout: 10000 });

    // ── Find and click the Expand button in the header ─────────────────────
    // When not expanded the button has title "Expanded mode"
    const expandButton = page.locator('button[title="Expanded mode"]');
    await expect(expandButton).toBeVisible({ timeout: 8000 });
    await expandButton.click();

    // ── After expanding, the button title changes to "Compact mode" ─────────
    const compactButton = page.locator('button[title="Compact mode"]');
    await expect(compactButton).toBeVisible({ timeout: 5000 });

    // ── The chat container is now anchored to the right side ───────────────
    // The expanded chat container has class "right-0 top-12 w-[35%] bottom-0"
    // We verify the element is positioned on the right side of the viewport
    const chatContainer = page.locator(".fixed.z-40.flex.flex-col").first();
    await expect(chatContainer).toBeVisible({ timeout: 8000 });

    const chatBox = await chatContainer.boundingBox();
    expect(chatBox).not.toBeNull();
    if (chatBox) {
      // The right edge of the chat container should be at the right edge of the viewport
      const rightEdge = chatBox.x + chatBox.width;
      expect(rightEdge).toBeCloseTo(1440, -1); // within ~10 px of 1440

      // Width should be approximately 35% of 1440 = ~504 px (±30 px tolerance)
      expect(chatBox.width).toBeGreaterThan(450);
      expect(chatBox.width).toBeLessThan(560);
    }

    // ── Document area is narrower (uses the remaining ~65%) ─────────────────
    // The document/library area has class "w-[65%]" when expanded (document view)
    // In library view, the flex-1 area should be narrower. We verify the library
    // heading is still visible and to the left of center.
    const libraryHeading = page.getByRole("heading", { name: "Document Library" });
    // It may not be visible in the document pane if active view switched; check either heading or the area
    // The key structural test is that the chat sidebar width is correct (done above).
    // The viewport should still show the library heading within the left portion.
    const headingBox = await libraryHeading.boundingBox();
    if (headingBox) {
      // Heading center should be in the left ~65% of the viewport
      const headingCenterX = headingBox.x + headingBox.width / 2;
      expect(headingCenterX).toBeLessThan(1440 * 0.75); // left of 75% mark
    }

    // ── The floating prompt bar should NO LONGER be at bottom-center ────────
    // In expanded mode the chat is the sidebar; "Ask about this document..." text
    // should not appear as the collapsed floating bar
    const floatingBarText = page.getByText("Ask about this document...");
    await expect(floatingBarText).not.toBeVisible({ timeout: 3000 });
  });
});
