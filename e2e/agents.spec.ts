import { test, expect } from "@playwright/test";

const TEST_EMAIL = "e2e-test@layers.test";
const TEST_PASSWORD = "E2eTest2026secure";

/**
 * Agents E2E tests
 *
 * Unauthenticated tests verify redirect behavior.
 * Authenticated tests verify agent template cards and navigation.
 */

test.describe("Agents (unauthenticated)", () => {
  test("redirects to login", async ({ page }) => {
    await page.goto("/agents");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe("Agents (authenticated)", () => {
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

  test("agents page loads with heading", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /agents/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("agents page shows template cards", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");

    // Verify known agent template names are visible
    await expect(page.getByText("Sales Call Analyzer")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Sprint Retrospective")).toBeVisible();
    await expect(page.getByText("Meeting Action Tracker")).toBeVisible();
    await expect(page.getByText("Onboarding Guide")).toBeVisible();
    await expect(page.getByText("Weekly Digest")).toBeVisible();
    await expect(page.getByText("Document Analyzer")).toBeVisible();
  });

  test("each template has a Use in Chat button", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");

    const useInChatButtons = page.getByRole("button", {
      name: /use in chat/i,
    });
    // 6 agent templates = 6 buttons
    await expect(useInChatButtons).toHaveCount(6);
  });

  test("clicking Use in Chat navigates with template param", async ({
    page,
  }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");

    // Click the first "Use in Chat" button (Sales Call Analyzer)
    const useInChatButtons = page.getByRole("button", {
      name: /use in chat/i,
    });
    await useInChatButtons.first().click();

    // Should navigate to /chat with a template query param
    await expect(page).toHaveURL(/\/chat\?template=/, { timeout: 10000 });
  });

  test("agents page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/agents");
    await page.waitForLoadState("networkidle");

    const realErrors = errors.filter((e) => !e.includes("ResizeObserver"));
    expect(realErrors).toHaveLength(0);
  });
});
