---
description: Run one turn of the Granger self-improvement loop — eval, research, design, implement, re-eval. Updates master plan + test checklist.
---

# /self-improve

Execute one turn of the self-improvement flywheel documented at `docs/plans/self-improve-loop.md`.

## Arguments

- `--area <chat|scheduling|library|mcp|skills|artifacts|mobile|tools>` — focus a single area (default: pick the area with most 🔴 rows in `master-improvement-plan.md`)
- `--research-only` — skip implementation; just run steps 1-3
- `--eval-only` — just run expect against current code and log results

## Steps

When invoked, perform these in order and WRITE FINDINGS TO THE PLAN as you go:

1. **EVAL**
   - Read `docs/plans/master-improvement-plan.md` — identify 🔴/🟡 rows for the target area
   - Run the matching expect plan: `pnpm expect:<area>`
   - Append results to `master-improvement-plan.md` "Eval Results Log" table
   - Append run row to `master-testing-checklist.md` "Run History" table
   - Screenshots land under `expect-out/<area>/`

2. **RESEARCH**
   - Pull latest from the standing research list in `docs/plans/self-improve-loop.md`
   - Focus on anything relevant to the failures found in step 1
   - Use WebFetch + WebSearch to cite real sources (Anthropic, OpenAI, Vercel, best-in-class products)
   - Write findings to `docs/research/<YYYY-MM-DD>-<topic>.md`
   - Link new research in the Research Log section of `master-improvement-plan.md`

3. **DESIGN**
   - Convert findings into concrete changes in the feature matrix
   - Add new rows to the AI Tool Coverage Matrix if a missing tool was identified
   - Add tasks to TodoWrite for the session

4. **IMPLEMENT** (skip if `--research-only`)
   - Smallest change that closes the gap
   - Add/extend the expect plan BEFORE writing code
   - Run `pnpm lint && pnpm typecheck && pnpm test`
   - Commit with a clear message; push

5. **RE-EVAL**
   - Re-run the area's expect plan
   - Confirm the gap closed
   - Update eval log and feature matrix status (🔴 → 🟢)

## Rules

- Always reason from retrieval: `docs/ai-sdk/`, `docs/ai-gateway/`, `docs/ai-elements/`, local research files — not training data
- Never implement without a failing expect scenario first
- Keep changes small — one gap per loop, not a sprint in one PR
- Every commit updates the changelog (`src/data/changelog.ts`) and the plan
- If a research finding changes strategy, ASK Alfonso before pivoting — don't just refactor unilaterally

## Example

```
/self-improve --area scheduling
```

Expected behavior:
1. Expect run on `/schedules` → fails on timezone abbreviation (shows UTC in light mode only)
2. Research: best practice for rendering localized cron descriptions
3. Design: fix adds tz param to `cronToHuman`
4. Implement: edit `src/lib/cron.ts`, extend expect plan
5. Re-eval: passes → close loop, commit

## Output

At the end, return a short summary:
- What failed
- What you learned (cite research links)
- What you shipped
- What's still 🔴 in this area
- Next loop's target
