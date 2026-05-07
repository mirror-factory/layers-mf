---
name: visual-qa
description: Verify UI changes across layout, styling, responsiveness, and browser behavior.
---

# Visual QA Skill

> Verify UI changes didn't break layout, styling, or functionality on desktop and mobile. Use after any change to `.tsx` or `.css` files.

## When to Use

- After modifying any component in `components/` or `app/`
- After changing CSS, Tailwind classes, or layout structure
- After adding new pages or routes with UI
- When user reports "it looks wrong" or "it's broken on mobile"
- Before committing UI changes

## Quick Check (30 seconds)

```bash
# Run smoke test — loads pages, checks for errors
pnpm test:smoke
```

This catches:
- Pages that don't load (500 errors)
- Console errors (hydration, missing imports)
- Horizontal overflow (double scrollbar)
- Interactive elements pushed off-screen

## Full Visual Check (1-2 minutes)

```bash
# Run visual regression — screenshots at 3 breakpoints
pnpm test:visual

# If baselines don't exist yet (first run):
npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots
```

This catches:
- CSS regressions (element moved, color changed, spacing broken)
- Mobile layout breaks (overflow, text truncation, missing elements)
- Tablet-specific issues

## AI-Powered Browser Test (costs ~$0.10-0.30)

For thorough verification including interactive elements:

```bash
# Start dev server if not running
pnpm dev &

# Run Expect CLI
EXPECT_BASE_URL=http://localhost:3000 npx expect-cli \
  -m "Verify the app loads correctly on desktop and mobile. Check that all interactive elements work, no visual bugs, no console errors. Test the chat interface, tool cards, and navigation." \
  -y --timeout 60000
```

Replays saved to `.expect/replays/` — open the HTML files to watch what the AI tested.

## Manual Verification Checklist

When automated tests aren't enough:

### Desktop (1440px)
- [ ] All pages load without blank content
- [ ] No horizontal scrollbar
- [ ] Chat input is visible and usable
- [ ] Tool cards render correctly (not raw JSON)
- [ ] Navigation works
- [ ] Modals/dialogs open and close properly

### Mobile (375px)
- [ ] Content doesn't overflow horizontally
- [ ] Chat input is reachable (not pushed below viewport)
- [ ] Text is readable (not truncated or overlapping)
- [ ] Touch targets are large enough (min 44px)
- [ ] Bottom navigation/toolbar doesn't overlap content

### Using Chrome MCP Tools

If you have Claude-in-Chrome available:

```
1. mcp__claude-in-chrome__tabs_context_mcp  → check current tabs
2. mcp__claude-in-chrome__navigate → go to the page
3. mcp__claude-in-chrome__resize_window → test at 375x812 (mobile)
4. mcp__claude-in-chrome__get_screenshot → capture what it looks like
5. mcp__claude-in-chrome__read_console_messages → check for errors
6. mcp__claude-in-chrome__resize_window → test at 1440x900 (desktop)
7. mcp__claude-in-chrome__get_screenshot → capture desktop view
```

## Common Issues This Catches

| Issue | Symptom | Root Cause |
|-------|---------|-----------|
| Double scrollbar | Horizontal scroll on page | Nested `overflow-auto` containers |
| Chat input gone | Can't type messages | CSS overflow pushing input below viewport |
| Invisible tool cards | Tool calls show raw JSON | Missing entry in `TOOL_RENDERERS` map |
| Save indicator lies | Shows "Saved" before save completes | Optimistic UI without waiting for response |
| Broken on mobile | Layout overlaps, text cut off | Missing responsive classes, fixed widths |
| Blank page | White screen, console errors | SSR error, missing dynamic import |

## After Fixing Issues

1. Run `pnpm test:smoke` to verify the fix
2. Run `pnpm test:visual --update-snapshots` if the fix changes the visual baseline intentionally
3. Check both desktop AND mobile — fixing one often breaks the other
