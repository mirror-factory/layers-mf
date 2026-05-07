---
description: "Print compressed PROJECT INDEX + active run state"
argument-hint: "(no args)"
---

# /kit-status -- snapshot of where the project stands

One-call readout of the kit's current state. Equivalent to skimming the
PROJECT INDEX block at the top of AGENTS.md plus checking
`.ai-dev-kit/state/current-run.json` -- useful at the start of a session,
after a long pause, or when you are about to pick up a feature someone
else was driving.

## Steps

1. **Project index.** Read `.ai-dev-kit/registries/index.yaml` (generated
   by `scripts/sync-project-index.ts`). If missing, say so and tell the
   user to run `pnpm exec tsx scripts/sync-project-index.ts` first.
   Otherwise extract:
   - project name + stack
   - per-feature row: status, test-manifest presence, routes, components,
     vendors, last_run timestamp
   - registry summary: `components.yaml`, `pages.yaml`, `tools.yaml`,
     `skills.yaml`, `design-tokens.yaml`, `design-system.yaml` entry counts
   - enforcement totals: `ai_calls_30d`, `cost_usd_30d`, `tests_30d`,
     `skill_invocations_30d`

2. **Active run.** Read `.ai-dev-kit/state/current-run.json`. If present,
   extract `run_id`, `feature`, `started_at`. If absent, say "no active
   run" and proceed.

3. **TDD log tail.** Read the last 5 lines of
   `.ai-dev-kit/state/tdd-log.jsonl` (if present). Show: last phase
   (`red`/`green`/`refactor`), feature, criterion (truncated), timestamp.

4. **Doctor hint.** If any of the following are missing or empty, surface
   a one-line doctor nudge for each:
   - `.ai-dev-kit/registries/design-tokens.yaml` has no `colors:` entries
   - `.ai-dev-kit/registries/pages.yaml` exists but has zero routes
   - `.ai-dev-kit/registries/dependencies.yaml` has a `last_audited`
     timestamp older than 14 days

5. **Print the snapshot.** Format the output as a readable block in chat;
   do NOT write a file. This command is read-only.

## Output shape

```
PROJECT: <name>  (<stack>)

FEATURES
  <feature-a>    status=drafting    2 flows | 3 cmps | vercel firecrawl | last_run=2026-04-18
  <feature-b>    status=shipping    5 flows | 8 cmps | anthropic        | last_run=2026-04-20

REGISTRIES
  components (12) | pages (6) | tools (3) | skills (5) | design-tokens (ok) | design-system (ok)

ENFORCEMENT (30d)
  ai_calls=284   cost_usd=12.37   tests=1847   skills=92

ACTIVE RUN
  run_id=<ULID>   feature=<feature>   started=<ISO>

TDD LOG (last 5)
  refactor  <feature>  "<criterion truncated>"  <ISO>
  green     <feature>  "<criterion truncated>"  <ISO>
  red       <feature>  "<criterion truncated>"  <ISO>
  ...

HINTS
  - pages.yaml empty -- run sync-registries.ts after adding routes
  - dependencies.yaml audit is 21 days old -- run sync-dependencies.ts
```

## Do not

- Mutate any file. This is read-only by contract.
- Run `doctor` or any sync script. Suggest them in the `HINTS` section but
  let the user decide; `/kit-status` should be instant and side-effect-free.
- Invoke any subagent. Summary only.
