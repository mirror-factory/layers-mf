import { test, expect } from "@playwright/test";

test.describe("Onboarding Flow", () => {
  test("should render welcome page with get started button", async ({ page }) => {
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    // Welcome page has the title and get started button
    await expect(page.getByText("Welcome to Layers")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("AI-powered workspace for context-rich collaboration", { exact: false })
    ).toBeVisible();

    // Should show the three onboarding steps
    await expect(page.getByText("Connect your tools")).toBeVisible();
    await expect(page.getByText("Create your first session")).toBeVisible();

    // Get started button should be present
    const getStartedBtn = page.getByRole("button", { name: /get started/i });
    await expect(getStartedBtn).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/onboarding-welcome.png", fullPage: true });
  });

  test("should render connect-tools page with integration options", async ({ page }) => {
    await page.goto("/onboarding/connect-tools");
    await page.waitForLoadState("networkidle");

    // Page heading
    await expect(page.getByText("Connect your tools")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Select the tools you use", { exact: false })
    ).toBeVisible();

    // Should show integration options
    await expect(page.getByText("Google Calendar")).toBeVisible();
    await expect(page.getByText("Linear")).toBeVisible();
    await expect(page.getByText("Notion")).toBeVisible();
    await expect(page.getByText("Slack")).toBeVisible();
    await expect(page.getByText("GitHub")).toBeVisible();
    await expect(page.getByText("Google Drive")).toBeVisible();

    // Should show descriptions
    await expect(page.getByText("Sync meetings and events")).toBeVisible();
    await expect(page.getByText("Import issues and projects")).toBeVisible();

    // Should have Skip and Continue buttons
    await expect(page.getByRole("button", { name: /skip for now/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/onboarding-connect-tools.png", fullPage: true });
  });

  test("should allow selecting tools on connect-tools page", async ({ page }) => {
    await page.goto("/onboarding/connect-tools");
    await page.waitForLoadState("networkidle");

    // Click on Linear to select it
    const linearButton = page.getByText("Linear").locator("..");
    await linearButton.click();
    await page.waitForTimeout(500);

    // Should show "Selected" indicator
    await expect(page.getByText("Selected").first()).toBeVisible();

    // Continue button should update count
    await expect(page.getByRole("button", { name: /continue \(1\)/i })).toBeVisible();

    // Select another tool
    const slackButton = page.getByText("Slack").locator("..");
    await slackButton.click();
    await page.waitForTimeout(500);

    // Count should update
    await expect(page.getByRole("button", { name: /continue \(2\)/i })).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/onboarding-tools-selected.png", fullPage: true });
  });

  test("should render first-session page with session creation form", async ({ page }) => {
    await page.goto("/onboarding/first-session");
    await page.waitForLoadState("networkidle");

    // Page heading
    await expect(
      page.getByText("Create your first session")
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Sessions are collaborative workspaces", { exact: false })
    ).toBeVisible();

    // Session name input
    const nameInput = page.getByLabel(/session name/i);
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveAttribute("placeholder", /Q1 Planning/);

    // Goal textarea (optional)
    const goalInput = page.getByLabel(/goal/i);
    await expect(goalInput).toBeVisible();

    // Info text about what you can do after creation
    await expect(
      page.getByText("add context, invite members, and chat with AI", { exact: false })
    ).toBeVisible();

    // Buttons
    await expect(page.getByRole("button", { name: /skip for now/i })).toBeVisible();
    const createBtn = page.getByRole("button", { name: /create session/i });
    await expect(createBtn).toBeVisible();

    // Create button should be disabled when name is empty
    await expect(createBtn).toBeDisabled();

    await page.screenshot({ path: "e2e/screenshots/onboarding-first-session.png", fullPage: true });
  });

  test("should enable create button when session name is filled", async ({ page }) => {
    await page.goto("/onboarding/first-session");
    await page.waitForLoadState("networkidle");

    const nameInput = page.getByLabel(/session name/i);
    const createBtn = page.getByRole("button", { name: /create session/i });

    // Initially disabled
    await expect(createBtn).toBeDisabled();

    // Fill in name
    await nameInput.fill("Sprint Review");
    await page.waitForTimeout(300);

    // Should now be enabled
    await expect(createBtn).toBeEnabled();

    await page.screenshot({ path: "e2e/screenshots/onboarding-session-filled.png", fullPage: true });
  });

  test("should render complete page with next steps", async ({ page }) => {
    await page.goto("/onboarding/complete");
    await page.waitForLoadState("networkidle");

    // Completion heading
    await expect(page.getByText("You're all set!")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Your workspace is ready", { exact: false })
    ).toBeVisible();

    // Next steps
    await expect(page.getByText("Chat with AI")).toBeVisible();
    await expect(page.getByText("Build your context library")).toBeVisible();
    await expect(page.getByText("Invite your team")).toBeVisible();

    // Go to dashboard button
    await expect(page.getByRole("button", { name: /go to dashboard/i })).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/onboarding-complete.png", fullPage: true });
  });

  test("should navigate through full onboarding flow", async ({ page }) => {
    // Start at welcome
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Welcome to Layers")).toBeVisible({ timeout: 10000 });

    // Click "Get started" → connect-tools
    await page.getByRole("button", { name: /get started/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Connect your tools")).toBeVisible({ timeout: 10000 });

    // Click "Skip for now" → first-session
    await page.getByRole("button", { name: /skip for now/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Create your first session")).toBeVisible({ timeout: 10000 });

    // Click "Skip for now" → complete
    await page.getByRole("button", { name: /skip for now/i }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("You're all set!")).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: "e2e/screenshots/onboarding-flow-complete.png", fullPage: true });
  });
});
