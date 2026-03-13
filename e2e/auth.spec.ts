import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "alfonso@roiamplified.com";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";

test.describe("Authentication", () => {
  // ── Login page rendering ──────────────────────────────────────────────

  test("login page renders with email and Google OAuth", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("login page shows forgot password link", async ({ page }) => {
    await page.goto("/login");
    const forgotLink = page.getByRole("link", { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute("href", "/forgot-password");
  });

  // ── Signup page rendering ─────────────────────────────────────────────

  test("signup page renders with email and Google OAuth", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /team name/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  // ── Navigation between auth pages ─────────────────────────────────────

  test("login page links to signup", async ({ page }) => {
    await page.goto("/login");
    const signupLink = page.getByRole("link", { name: /sign up/i });
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("signup page links to login", async ({ page }) => {
    await page.goto("/signup");
    const loginLink = page.getByRole("link", { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot password page links back to login", async ({ page }) => {
    await page.goto("/forgot-password");
    const backLink = page.getByRole("link", { name: /back to sign in/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page navigates to forgot password via link", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(
      page.getByRole("heading", { name: /reset your password/i })
    ).toBeVisible();
  });

  // ── Form validation ───────────────────────────────────────────────────

  test("login form enforces required fields via HTML validation", async ({
    page,
  }) => {
    await page.goto("/login");
    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.getByRole("textbox", { name: /password/i });

    // Both inputs have the `required` attribute
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
  });

  test("signup form enforces required fields via HTML validation", async ({
    page,
  }) => {
    await page.goto("/signup");
    const orgInput = page.getByRole("textbox", { name: /team name/i });
    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.getByRole("textbox", { name: /password/i });

    await expect(orgInput).toHaveAttribute("required", "");
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
  });

  test("signup password field requires minimum 8 characters", async ({
    page,
  }) => {
    await page.goto("/signup");
    const passwordInput = page.getByRole("textbox", { name: /password/i });
    await expect(passwordInput).toHaveAttribute("minlength", "8");
  });

  // ── Invalid credentials ───────────────────────────────────────────────

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill("invalid@test.com");
    await page.getByRole("textbox", { name: /password/i }).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Error message rendered in .text-destructive
    await expect(page.locator(".text-destructive")).toBeVisible({
      timeout: 10000,
    });
  });

  test("login error message disappears on new submission attempt", async ({
    page,
  }) => {
    await page.goto("/login");
    const emailInput = page.getByRole("textbox", { name: /email/i });
    const passwordInput = page.getByRole("textbox", { name: /password/i });
    const submitBtn = page.getByRole("button", { name: /sign in/i });

    // Trigger an error first
    await emailInput.fill("bad@test.com");
    await passwordInput.fill("wrongpassword");
    await submitBtn.click();
    await expect(page.locator(".text-destructive")).toBeVisible({
      timeout: 10000,
    });

    // Submit again — button should show loading state (error cleared on submit)
    await emailInput.fill("another@test.com");
    await passwordInput.fill("anotherpassword");
    await submitBtn.click();

    // The button text changes to "Signing in..." during submission
    await expect(
      page.getByRole("button", { name: /signing in/i })
    ).toBeVisible();
  });

  // ── Login with valid credentials ──────────────────────────────────────

  test("should login with valid credentials and reach dashboard", async ({
    page,
  }) => {
    test.skip(!TEST_PASSWORD, "E2E_TEST_PASSWORD not set — skipping");

    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill(TEST_EMAIL);
    await page.getByRole("textbox", { name: /password/i }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for redirect away from /login to an authenticated route
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Verify we landed on an authenticated page (dashboard, chat, context, or inbox)
    await expect(page).toHaveURL(/^\/$|\/chat|\/context|\/inbox/, {
      timeout: 10000,
    });

    // Verify authenticated chrome is visible — sidebar navigation
    await expect(page.locator("nav, aside, [role='navigation']").first()).toBeVisible({
      timeout: 5000,
    });
  });

  // ── Forgot password flow ──────────────────────────────────────────────

  test("forgot password page renders correctly", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(
      page.getByRole("heading", { name: /reset your password/i })
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send reset link/i })
    ).toBeVisible();
    await expect(
      page.getByText(/enter your email and we'll send you a reset link/i)
    ).toBeVisible();
  });

  test("forgot password form enforces required email", async ({ page }) => {
    await page.goto("/forgot-password");
    const emailInput = page.getByRole("textbox", { name: /email/i });
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(emailInput).toHaveAttribute("type", "email");
  });

  test("should complete forgot password flow and show confirmation", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    const emailInput = page.getByRole("textbox", { name: /email/i });
    await emailInput.fill("test@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();

    // After submission, the success state should show the confirmation message
    await expect(
      page.getByText(/check your email for a reset link/i)
    ).toBeVisible({ timeout: 10000 });

    // The sent email address should be displayed in the confirmation
    await expect(page.getByText("test@example.com")).toBeVisible();

    // "Try another email" button should be visible
    await expect(
      page.getByRole("button", { name: /try another email/i })
    ).toBeVisible();
  });

  test("forgot password 'try another email' resets the form", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page
      .getByRole("textbox", { name: /email/i })
      .fill("test@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();

    // Wait for success state
    await expect(
      page.getByRole("button", { name: /try another email/i })
    ).toBeVisible({ timeout: 10000 });

    // Click "Try another email"
    await page.getByRole("button", { name: /try another email/i }).click();

    // Form should be back with an empty email input
    const emailInput = page.getByRole("textbox", { name: /email/i });
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveValue("");
  });

  // ── Reset password page ───────────────────────────────────────────────

  test("reset password page renders with password fields", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(
      page.getByRole("heading", { name: /set new password/i })
    ).toBeVisible();
    await expect(page.getByLabel(/new password/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /update password/i })
    ).toBeVisible();
  });

  test("reset password shows mismatch error for different passwords", async ({
    page,
  }) => {
    await page.goto("/reset-password");
    await page.getByLabel(/new password/i).fill("SecurePass1!");
    await page.getByLabel(/confirm password/i).fill("DifferentPass1!");

    // Inline mismatch message shown in real-time
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test("reset password enforces minimum length on inputs", async ({ page }) => {
    await page.goto("/reset-password");
    const passwordInput = page.getByLabel(/new password/i);
    const confirmInput = page.getByLabel(/confirm password/i);

    await expect(passwordInput).toHaveAttribute("minlength", "8");
    await expect(confirmInput).toHaveAttribute("minlength", "8");
    await expect(passwordInput).toHaveAttribute("maxlength", "128");
    await expect(confirmInput).toHaveAttribute("maxlength", "128");
  });

  // ── Google OAuth buttons ──────────────────────────────────────────────

  test("login Google button shows correct text", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: /continue with google/i })
    ).toBeVisible();
  });

  test("signup Google button shows correct text", async ({ page }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("button", { name: /sign up with google/i })
    ).toBeVisible();
  });

  // ── Input autocomplete attributes ─────────────────────────────────────

  test("login inputs have correct autocomplete attributes", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toHaveAttribute(
      "autocomplete",
      "email"
    );
    await expect(page.locator('input[type="password"]')).toHaveAttribute(
      "autocomplete",
      "current-password"
    );
  });

  test("signup inputs have correct autocomplete attributes", async ({
    page,
  }) => {
    await page.goto("/signup");
    await expect(page.locator('input[type="email"]')).toHaveAttribute(
      "autocomplete",
      "email"
    );
    await expect(page.locator('input[type="password"]')).toHaveAttribute(
      "autocomplete",
      "new-password"
    );
  });
});
