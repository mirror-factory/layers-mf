/**
 * visual.sample.spec.ts -- template for a visual regression test.
 *
 * Every component in components.yaml and every page in pages.yaml should
 * eventually have a spec like this. Copy, rename, point at the route, and
 * commit baselines via VISUAL_UPDATE=1.
 *
 * The four projects in playwright.config.ts (mobile-light, mobile-dark,
 * tablet-light, tablet-dark, desktop-light, desktop-dark) all run the same
 * spec, producing six baselines per test.
 */
import { test, expect } from "@playwright/test";

test.describe("visual: home page", () => {
  test("matches baseline", async ({ page }, testInfo) => {
    await page.goto("/");

    // Mask dynamic regions so timestamps / random IDs don't flake baselines.
    // const timestamp = page.locator('[data-test-id="timestamp"]');

    await expect(page).toHaveScreenshot(`home-${testInfo.project.name}.png`, {
      fullPage: true,
      animations: "disabled",
      // mask: [timestamp],
      maxDiffPixelRatio: 0.01,
    });
  });
});
