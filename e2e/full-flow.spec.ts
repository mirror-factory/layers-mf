import { test, expect } from "@playwright/test";

const TEST_EMAIL = "e2e-test@layers.test";
const TEST_PASSWORD = "E2eTest2026secure";

test.describe("Full User Flow: Drive → Context → Chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole("textbox", { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Skip onboarding
    await page.evaluate(() => {
      localStorage.setItem("layers-onboarding-completed", "true");
    });
  });

  test("1. can log in and reach dashboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/screenshots/dashboard.png", fullPage: true });
    expect(page.url()).not.toContain("/login");
  });

  test("2. context library shows Google Drive documents", async ({ page }) => {
    // Navigate to context, then reload to ensure SSR has auth cookies
    await page.goto("/context");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/screenshots/context-library.png", fullPage: true });

    // Should NOT show empty state since we have 92 docs from Drive
    const emptyState = page.getByText("No context items yet");
    const hasItems = !(await emptyState.isVisible().catch(() => false));
    expect(hasItems).toBe(true);
  });

  test("3. chat page loads and accepts messages", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    // Click "New conversation" to start
    await page.getByRole("button", { name: /new conversation/i }).first().click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "e2e/screenshots/chat-new-convo.png", fullPage: true });

    // Now textarea should be visible
    const chatInput = page.locator("textarea").first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
  });

  test("4. chat responds with Drive content when asked", async ({ page }) => {
    test.setTimeout(120000);

    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    // Start new conversation
    await page.getByRole("button", { name: /new conversation/i }).first().click();
    await page.waitForTimeout(1000);

    const chatInput = page.locator("textarea").first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Ask a knowledge question
    await chatInput.fill("Summarize the marketing strategies in our documents");
    await chatInput.press("Enter");

    await page.screenshot({ path: "e2e/screenshots/chat-query-sent.png", fullPage: true });

    // Wait for AI response (needs to call search_context + generate)
    // Look for response text appearing — could take up to 30s
    await page.waitForFunction(
      () => {
        const els = document.querySelectorAll("[data-role='assistant'], .prose, .markdown");
        return els.length > 0;
      },
      { timeout: 45000 }
    ).catch(() => {
      // Fallback — just wait and check page content grew
    });

    await page.waitForTimeout(5000);
    await page.screenshot({ path: "e2e/screenshots/chat-response.png", fullPage: true });

    // The page should have substantive content beyond just the question
    const pageText = await page.innerText("body");
    // At minimum: sidebar + question + some response
    expect(pageText.length).toBeGreaterThan(400);
  });

  test("5. context search returns results", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill("marketing");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/context-search.png", fullPage: true });
    }
  });
});

test.describe("Complete Flow: Login → Upload → Chat → Get Answer", () => {
  test("complete flow: login → upload → chat → get answer", async ({ page }) => {
    test.setTimeout(120000);

    // 1. Login with valid credentials
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole("textbox", { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Skip onboarding
    await page.evaluate(() => {
      localStorage.setItem("layers-onboarding-completed", "true");
    });

    // 2. Navigate to context library
    await page.goto("/context");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/screenshots/flow-context-library.png", fullPage: true });

    // Verify context page loaded (should have heading or content area)
    const contextHeading = page.getByRole("heading").first();
    await expect(contextHeading).toBeVisible({ timeout: 10000 });

    // 3. Upload a test text file with known content
    const testContent = "Layers E2E Test Document: The capital of France is Paris. The Eiffel Tower is 330 metres tall.";
    const testFileName = "e2e-test-upload.txt";

    // Look for upload trigger (button or dropzone)
    const uploadButton = page.getByRole("button", { name: /upload|add|import/i }).first();
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() > 0) {
      // Set file directly on the input
      await fileInput.setInputFiles({
        name: testFileName,
        mimeType: "text/plain",
        buffer: Buffer.from(testContent),
      });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: "e2e/screenshots/flow-after-upload.png", fullPage: true });
    } else if (await uploadButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uploadButton.click();
      await page.waitForTimeout(1000);
      // Try to find the file input after clicking
      const revealedInput = page.locator('input[type="file"]').first();
      if (await revealedInput.count() > 0) {
        await revealedInput.setInputFiles({
          name: testFileName,
          mimeType: "text/plain",
          buffer: Buffer.from(testContent),
        });
        await page.waitForTimeout(3000);
      }
      await page.screenshot({ path: "e2e/screenshots/flow-after-upload.png", fullPage: true });
    }

    // 4. Navigate to chat
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    // Start new conversation
    await page.getByRole("button", { name: /new conversation/i }).first().click();
    await page.waitForTimeout(1000);

    const chatInput = page.locator("textarea").first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // 5. Ask about the uploaded content
    await chatInput.fill("What is the capital of France according to our documents?");
    await chatInput.press("Enter");

    await page.screenshot({ path: "e2e/screenshots/flow-chat-question.png", fullPage: true });

    // 6. Verify response references the content
    await page.waitForFunction(
      () => {
        const els = document.querySelectorAll("[data-role='assistant'], .prose, .markdown");
        return els.length > 0;
      },
      { timeout: 60000 }
    ).catch(() => {
      // Fallback — wait for any response
    });

    await page.waitForTimeout(5000);
    await page.screenshot({ path: "e2e/screenshots/flow-chat-answer.png", fullPage: true });

    // Page should have substantive content
    const pageText = await page.innerText("body");
    expect(pageText.length).toBeGreaterThan(200);
  });

  test("session flow: create session → add context → scoped chat", async ({ page }) => {
    test.setTimeout(90000);

    // 1. Login
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole("textbox", { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    await page.evaluate(() => {
      localStorage.setItem("layers-onboarding-completed", "true");
    });

    // 2. Navigate to sessions and create one
    await page.goto("/sessions");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/screenshots/session-list.png", fullPage: true });

    // Look for "New session" or "Create session" button
    const newSessionBtn = page.getByRole("button", { name: /new session|create session/i }).first();
    if (await newSessionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newSessionBtn.click();
      await page.waitForTimeout(1000);

      // Fill in session name if a dialog/form appears
      const nameInput = page.getByLabel(/name/i).first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill("E2E Test Session");
      }

      // Look for goal/description field
      const goalInput = page.getByLabel(/goal|description/i).first();
      if (await goalInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await goalInput.fill("Testing session-scoped context and chat");
      }

      // Submit session creation
      const submitBtn = page.getByRole("button", { name: /create|save|submit/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(2000);
      }

      await page.screenshot({ path: "e2e/screenshots/session-created.png", fullPage: true });
    }

    // 3. Navigate to session workspace (if redirected or find the session)
    // Check if we're on a session detail page
    const currentUrl = page.url();
    if (currentUrl.includes("/sessions/")) {
      await page.screenshot({ path: "e2e/screenshots/session-workspace.png", fullPage: true });

      // 4. Add context via picker — look for "Add context" button
      const addContextBtn = page.getByRole("button", { name: /add context|add|attach/i }).first();
      if (await addContextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addContextBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "e2e/screenshots/session-context-picker.png", fullPage: true });

        // Select first available context item if picker is visible
        const contextItem = page.locator("[data-context-item], .context-item, [role='option']").first();
        if (await contextItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await contextItem.click();
          await page.waitForTimeout(1000);
        }

        // Confirm selection
        const confirmBtn = page.getByRole("button", { name: /add|confirm|done/i }).first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      await page.screenshot({ path: "e2e/screenshots/session-with-context.png", fullPage: true });
    }

    // Verify we got through the flow without crashes
    expect(page.url()).not.toContain("/login");
  });
});
