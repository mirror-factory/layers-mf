/**
 * Auto-scaffolded by sync-registries.ts for artifact-version-history.
 *
 * Runs across the 6-project matrix (mobile/tablet/desktop x light/dark)
 * from playwright.config.ts. Starts NOT-skipped (as of 0.2.8) so the
 * baseline either exists or the push fails loud.
 *
 * First run on this component: the test will fail because no baseline PNG
 * is committed yet. Create the baselines with:
 *
 *   VISUAL_UPDATE=1 pnpm exec playwright test tests/visual/artifact-version-history.spec.ts
 *
 * Commit the generated PNGs alongside this spec. Subsequent pushes compare
 * against them with maxDiffPixelRatio 0.01.
 *
 * Extend: replace the `/` route with a Storybook URL or a dedicated test
 * page, add interaction states (hover/focus/loading), mock props as needed.
 */
import { test, expect } from "@playwright/test";

test.describe("visual: artifact-version-history", () => {
  test("matches baseline", async ({ page }, testInfo) => {
    // TODO: point at a Storybook URL / dedicated test page rendering artifact-version-history.
    await page.goto("/");
    await expect(page).toHaveScreenshot(
      `artifact-version-history-${testInfo.project.name}.png`,
      { animations: "disabled", maxDiffPixelRatio: 0.01 },
    );
  });
});
