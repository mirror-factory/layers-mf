import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("renders the public landing page", async ({ page }) => {
    // The root page may redirect to login or show a landing page
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);
  });
});
