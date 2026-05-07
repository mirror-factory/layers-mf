# Phase B Validation — Manual Codex Runs

> Status: **PENDING** — actual Codex CLI runs deferred until Phase C standup
> on CT 102 provides a working Codex environment. This doc lists the candidate
> tickets identified during Phase B implementation and the validation criteria
> each will exercise.

## Why deferred

Phase B Task 8 calls for 3–5 manual Codex runs to validate the gates produce
signal at the right speed *before Symphony exists*. Running this from CT 100
(the dev container) would require installing Codex CLI here and managing
secrets outside the Symphony orchestrator's secret store — duplicating work
that Phase C does properly. Cleaner path: do the manual runs from CT 102
once it's stood up, before Symphony's auto-dispatch is enabled.

## Candidate tickets (file as Linear tickets with `agent:codex` + `validation:phase-b`)

### Identified during Phase B implementation

These are real issues surfaced by the new gates — perfect validation material
because they were caught by the kit but not yet fixed:

1. **AI SDK v6 deprecations: `streamText` without `stopWhen`**
   - Source: `src/lib/ai/tools.ts:1946` (and others — full list from
     `pnpm exec node node_modules/@mirror-factory/ai-dev-kit/scripts/check-deprecations.ts`)
   - Acceptance: every `streamText` call with tools also passes `stopWhen: stepCountIs(N)`
   - Validates: Tier 1 unit tests (each affected helper has a test); Tier 2 if any
     route changes need E2E coverage

2. **AI SDK v6 deprecations: `chat.append` → `chat.sendMessage`**
   - Source: `src/lib/log-aggregator.ts:112` (and any other call sites)
   - Acceptance: no remaining `.append(` calls on chat objects; replaced with
     `.sendMessage(`
   - Validates: Tier 1 contract tests; layer-boundary lint should not fire

3. **Layer-boundary violation: `lib/` importing `@/components/ambient-ai-card`**
   - Source: surfaced by ESLint during Phase B Task 5 (one of 3 violations)
   - Acceptance: refactor so the dependency flips (component imports from lib,
     not the other way), or extract shared logic to `lib/` proper
   - Validates: Tier 0 (ESLint warning resolved); Tier 1 unit tests survive
     refactor

4. **Layer-boundary violation: 2× `components/` importing from `@/app/portal/[token]/page`**
   - Source: surfaced by ESLint during Phase B Task 5
   - Acceptance: components should not import from route files; lift the shared
     logic into `lib/portal/`
   - Validates: same as above

### Backlog candidates (pick 1-2 from Linear `Layers 2026.1`)

To round out the 3–5 ticket validation set, pick from the existing Linear
backlog. Criteria: self-contained, <2h human work, clear acceptance criteria,
exercises a Tier the implementation tickets above don't (e.g., a UI-only
ticket to verify Tier 2 a11y + visual-regression flow).

## Validation criteria per ticket

For each Codex run, document:

- **Outcome**: PR opened / blocked / failed
- **Tier 0 result**: ✓ caught X / ✗ missed Y / ○ skipped (gate not yet wired)
- **Tier 1 result**: ✓ / ✗ — was the unit/contract test the agent wrote a real
  acceptance test, or just shape?
- **Tier 2 result**: ✓ / ✗ — did Playwright catch any UI/integration issue
  Tier 1 missed?
- **Layer-boundary lint**: did any new imports trip the rule?
- **Per-worktree port**: did `pick-dev-port.mjs` produce a stable, non-colliding
  port? Did concurrent workers conflict?
- **Langfuse trace**: link to the trace; was the cost recorded?
- **PR target**: confirmed against `development`?
- **Chrome DevTools walkthrough**: was it recorded and attached?

## Gate-tuning iteration log

Empty until validation runs happen. Each iteration:
- What gate fired at the wrong cadence (too slow / too narrow / false positive)
- Which `tiers` config or `WORKFLOW.md` line was tuned
- Effect on subsequent runs

## Decision log

- **2026-05-07**: Phase B implementation complete; validation deferred to
  Phase C standup (when Codex CLI is provisioned on CT 102 with proper secrets).
  Tasks 1-7 + 10 land first; Task 8 (validation) and Task 9 (flip
  `useTieredRouting: true`) execute against the live Codex environment.

- **2026-05-07**: `hooks.useTieredRouting` stays `false` for the Phase B PR.
  The flag flip happens in a follow-up commit on `development` once at least
  3 validation runs document Tier 1 producing usable signal. This avoids
  shipping a hook config that no human has driven end-to-end.
