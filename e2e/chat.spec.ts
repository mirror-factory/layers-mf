import { test, expect } from "@playwright/test";

test.describe("Chat Interface", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    // Skip onboarding if present
    await page.evaluate(() => {
      localStorage.setItem("layers-onboarding-completed", "true");
    });

    // Start a new conversation so the ChatInterface mounts
    await page.getByRole("button", { name: /new conversation/i }).first().click();
    await page.waitForTimeout(1000);
  });

  test("should render chat page with input area", async ({ page }) => {
    // Verify the chat page header is visible
    await expect(page.getByRole("heading", { name: "Chat" })).toBeVisible();
    await expect(
      page.getByText("Ask questions across all your team's context.")
    ).toBeVisible();

    // Verify the chat input textarea is visible
    const chatInput = page.getByTestId("chat-input");
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    await expect(chatInput).toHaveAttribute(
      "placeholder",
      "Ask about your documents, meetings, or team…"
    );

    // Verify the send button is visible
    const sendButton = page.getByTestId("chat-submit");
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled(); // disabled when input is empty
  });

  test("should show model selector", async ({ page }) => {
    // Verify model selector trigger is visible
    const modelSelector = page.getByTestId("model-selector");
    await expect(modelSelector).toBeVisible({ timeout: 10000 });

    // Default model should be Claude Haiku
    await expect(modelSelector).toContainText("Claude Haiku");

    // Click to open and verify model options appear
    await modelSelector.click();
    await expect(page.getByRole("option", { name: "Claude Sonnet" })).toBeVisible();
    await expect(page.getByRole("option", { name: "GPT-4o mini" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Gemini Flash" })).toBeVisible();
  });

  test("should accept user input", async ({ page }) => {
    const chatInput = page.getByTestId("chat-input");
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Type a message and verify it appears
    await chatInput.fill("What are the latest meeting notes?");
    await expect(chatInput).toHaveValue("What are the latest meeting notes?");

    // Send button should now be enabled
    const sendButton = page.getByTestId("chat-submit");
    await expect(sendButton).toBeEnabled();
  });

  test("should show empty state with prompt suggestions", async ({ page }) => {
    // The empty state should show prompt suggestions before any messages
    await expect(
      page.getByText("Ask anything about your team's knowledge")
    ).toBeVisible({ timeout: 10000 });

    // Verify suggested prompts are visible
    await expect(
      page.getByRole("button", { name: "Summarize last week\u2019s meetings" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "What decisions were made about the roadmap?" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Find documents about onboarding" })
    ).toBeVisible();
  });

  test("should send message on submit", async ({ page }) => {
    test.setTimeout(60000);

    const chatInput = page.getByTestId("chat-input");
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Type and submit a message
    await chatInput.fill("Hello, this is a test message");
    await page.getByTestId("chat-submit").click();

    // Input should be cleared after sending
    await expect(chatInput).toHaveValue("");

    // User message should appear in the chat — look for the message bubble with user styling
    const userMessage = page.getByTestId("user-message").first();
    await expect(userMessage).toBeVisible({ timeout: 10000 });
    await expect(userMessage).toContainText("Hello, this is a test message");
  });

  test("should send message on Enter key", async ({ page }) => {
    test.setTimeout(60000);

    const chatInput = page.getByTestId("chat-input");
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    await chatInput.fill("Testing Enter key submission");
    await chatInput.press("Enter");

    // Input should clear
    await expect(chatInput).toHaveValue("");

    // User message should appear
    const userMessage = page.getByTestId("user-message").first();
    await expect(userMessage).toBeVisible({ timeout: 10000 });
    await expect(userMessage).toContainText("Testing Enter key submission");
  });

  test("should display streaming assistant response", async ({ page }) => {
    test.setTimeout(90000);

    const chatInput = page.getByTestId("chat-input");
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    await chatInput.fill("What is Layers?");
    await page.getByTestId("chat-submit").click();

    // Should show loading indicator while streaming
    await expect(page.getByText("Researching…")).toBeVisible({ timeout: 15000 });

    // Wait for assistant response to appear
    const assistantMessage = page.getByTestId("assistant-message").first();
    await expect(assistantMessage).toBeVisible({ timeout: 45000 });

    // Assistant response should have meaningful content
    const responseText = await assistantMessage.innerText();
    expect(responseText.length).toBeGreaterThan(10);
  });

  test("should show tool calls when agent searches", async ({ page }) => {
    test.setTimeout(120000);

    const chatInput = page.getByTestId("chat-input");
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Ask something that should trigger search_context tool
    await chatInput.fill("Summarize the marketing strategies in our documents");
    await page.getByTestId("chat-submit").click();

    // Wait for tool call UI to appear — the Tool component wraps in a Collapsible with a border
    const toolCall = page.getByTestId("tool-call").first();
    await expect(toolCall).toBeVisible({ timeout: 30000 });

    // Tool header should show the tool name and status
    await expect(toolCall.locator("text=search_context").or(toolCall.locator("text=search-context"))).toBeVisible({
      timeout: 5000,
    });

    // Wait for the tool to complete (status badge shows "Completed")
    await expect(toolCall.getByText("Completed")).toBeVisible({ timeout: 30000 });

    // After tool completes, assistant message should eventually appear
    const assistantMessage = page.getByTestId("assistant-message").first();
    await expect(assistantMessage).toBeVisible({ timeout: 45000 });
  });

  test("should show source citations after search", async ({ page }) => {
    test.setTimeout(120000);

    const chatInput = page.getByTestId("chat-input");
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Ask a question that triggers context search with citations
    await chatInput.fill("Find documents about onboarding");
    await page.getByTestId("chat-submit").click();

    // Wait for assistant response
    const assistantMessage = page.getByTestId("assistant-message").first();
    await expect(assistantMessage).toBeVisible({ timeout: 60000 });

    // Check for source citations — they appear as badges below the message
    const sourceCitation = page.getByTestId("source-citation").first();
    await expect(sourceCitation).toBeVisible({ timeout: 10000 });

    // Source citations should contain badge elements with source info
    const badges = sourceCitation.locator('[data-slot="badge"]');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should display context panel on desktop", async ({ page }) => {
    // The context panel is only visible on lg+ screens
    const viewportSize = page.viewportSize();
    if (viewportSize && viewportSize.width >= 1024) {
      await expect(page.getByText("Context Retrieved")).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByText("Send a message to see which documents were retrieved.")
      ).toBeVisible();
    }
  });

  test("should show conversation sidebar with new conversation button", async ({ page }) => {
    // The sidebar should show the "New conversation" button
    const newConvoButton = page.getByRole("button", { name: /new conversation/i }).first();
    await expect(newConvoButton).toBeVisible();
  });

  test("should switch models via selector", async ({ page }) => {
    const modelSelector = page.getByTestId("model-selector");
    await expect(modelSelector).toBeVisible({ timeout: 10000 });

    // Switch to GPT-4o mini
    await modelSelector.click();
    await page.getByRole("option", { name: "GPT-4o mini" }).click();

    // Verify model changed
    await expect(modelSelector).toContainText("GPT-4o mini");
  });
});
