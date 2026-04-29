# Visual regression tests

Every component declared in `.ai-dev-kit/registries/components.yaml` and every
page in `pages.yaml` should have a Playwright `toHaveScreenshot` spec here.

The kit ships:

- `visual.sample.spec.ts` — example spec you can copy
- `__screenshots__/` — baselines (committed; updated with `VISUAL_UPDATE=1`)

## How it's enforced

**pre-push** runs `npx playwright test --project=mobile-light --project=mobile-dark --project=tablet-light --project=tablet-dark --project=desktop-light --project=desktop-dark`. Any screenshot that doesn't match baseline within the configured pixel ratio threshold fails the push, fail-closed.

**doctor** warns when a component has no sibling visual spec OR when baselines exist but are older than the component source file.

## Updating baselines intentionally

```bash
VISUAL_UPDATE=1 pnpm exec playwright test tests/visual
```

Always commit the updated screenshots in the same commit as the component change. CI verifies the two live together.

## What NOT to put in visual specs

- Animations that depend on timing. Freeze animations with `reducedMotion: 'reduce'`.
- Dynamic text (timestamps, random IDs). Mask with `mask: [locator]`.
- Third-party iframes (analytics, embeds). Mask or stub.
