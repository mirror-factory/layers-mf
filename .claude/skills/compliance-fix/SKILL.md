---
name: compliance-fix
description: Run compliance checks and fix enforcement failures before commits or pushes.
---

# Compliance Fix Skill

> Run the compliance checker and fix every failure. Use after making code changes and before committing.

## When to Use

- Before every commit (automated via pre-push hook)
- After adding new tools, routes, or AI call sites
- After modifying UI components (chat, tool renderers)
- When the pre-push hook blocks your push
- Periodically during long coding sessions

## Run the Check

```bash
pnpm compliance
```

## How to Fix Each Failure

### 1. "AI calls missing telemetry"

**What it checks:** Every file in `app/api/` and `lib/ai/` that contains `streamText(` or `generateText(` must also contain `experimental_telemetry` or `withTelemetry`.

**How to fix:**
```typescript
// Import the middleware
import { withTelemetry, logAICall } from '@/lib/ai/telemetry';

// Wrap the model
const model = withTelemetry(aiGateway('google/gemini-3-flash'), {
  userId: user.id, chatId, label: 'chat'
});

// Use the wrapped model
const result = await streamText({ model, ... });
```

See the `wire-telemetry` skill for the full pattern.

### 2. "N test file(s) with @ts-nocheck"

**What it checks:** No file in `tests/` contains `@ts-nocheck`.

**How to fix:**
1. Remove the `// @ts-nocheck` line from the file
2. Fix the resulting type errors — usually stale mock shapes
3. Use `ToolUIPartLike` or proper typed mocks instead of `as any`
4. If a type is genuinely hard to mock, use `// @ts-expect-error — mock shape intentionally simplified` with a description

### 3. "No smoke test found"

**What it checks:** At least one file matching `smoke*.spec.ts` exists in `tests/`.

**How to fix:** Copy from starter kit:
```bash
cp /path/to/starter-kit/testing/e2e/smoke.spec.ts tests/e2e/smoke.spec.ts
```
Then customize the `PAGES` array with your app's routes.

### 4. "No reasoning part handler found"

**What it checks:** At least one chat component file handles `'reasoning'` part type.

**How to fix:** In your chat message renderer:
```typescript
if (part.type === 'reasoning') {
  return (
    <details className="text-sm text-muted-foreground">
      <summary>Thinking...</summary>
      <p>{part.text}</p>
    </details>
  );
}
```

### 5. "No nightly CI workflow found"

**What it checks:** `.github/workflows/nightly.yml` (or `scheduled.yml`) exists.

**How to fix:** Copy from starter kit:
```bash
cp /path/to/starter-kit/templates/.github/workflows/nightly.yml .github/workflows/nightly.yml
```

### 6. "console.log(s) found in source"

**What it checks:** No `console.log(` in `lib/` or `components/` files (excluding comments and lines with `// keep`).

**How to fix:**
- Replace with structured logger: `import { aiLogger } from '@/lib/ai/ai-logger'`
- Or use `console.warn` / `console.error` for intentional logging
- Or add `// keep` comment if the log is truly needed in production

### 7. "docs/reference/ is stale"

**What it checks:** Reference docs were updated within the last 7 days.

**How to fix:**
```bash
pnpm docs:generate
git add docs/reference/
```

### 8. "No llms.txt found"

**What it checks:** `llms.txt` or `llms-full.txt` exists in project root.

**How to fix:** Copy from starter kit and customize:
```bash
cp /path/to/starter-kit/templates/llms.txt ./llms.txt
```

### 9. "Tool registry exists but no mock data found"

**What it checks:** If a tool metadata file exists, mock data files should exist too.

**How to fix:** Create `lib/registry/mock-tool-data.ts` with mock outputs for each tool. See starter kit `testing/patterns/02-registry-enforcement.ts`.

### 10. "No AGENTS.md or CLAUDE.md found"

**What it checks:** Agent context file exists in project root.

**How to fix:** Copy and customize:
```bash
cp /path/to/starter-kit/AGENTS.md.template ./AGENTS.md
```

### 11. "No visual regression tests"

**What it checks:** Files matching `visual*.spec.ts` or usage of `toHaveScreenshot` in E2E tests.

**How to fix:** Copy from starter kit:
```bash
cp /path/to/starter-kit/testing/e2e/visual-regression.spec.ts tests/e2e/
npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots  # Generate baselines
```

### 12. "Missing hooks: .husky/pre-commit, .husky/pre-push"

**What it checks:** Both Husky hook files exist.

**How to fix:**
```bash
npx husky init
echo 'pnpm typecheck && pnpm test' > .husky/pre-commit
echo 'pnpm typecheck && pnpm test && pnpm compliance' > .husky/pre-push
chmod +x .husky/pre-commit .husky/pre-push
```
