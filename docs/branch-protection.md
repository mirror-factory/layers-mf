# Branch Protection Configuration

> Last updated: 2026-05-07
>
> Configure these via GitHub UI: Repo Settings → Branches → Add rule.

## `development` (integration trunk; Symphony agents target this)

- ✅ Require a pull request before merging
- ✅ Required status checks (must pass before merge):
  - `Typecheck, Lint, Test` (existing CI job)
  - `E2E (Playwright, Tier 2)` — added in Phase B Task 4
- ✅ Require branches to be up to date before merging
- ✅ Allow squash merge (only)
- ❌ Disable merge commit / rebase merge
- ❌ Do not require linear history (squash gives us that)
- ❌ Do not require signed commits (defer to v2)

## `staging` (pre-prod soak; created in Phase C)

Set up before Phase C go-live:

- ✅ Require pull request from `development` only
- ✅ Required status checks:
  - All `development` checks
  - `Tier 3` (visual regression + LLM judge + sampled real-model evals — added in Phase C)
- ✅ Restrict who can push (admins only)

## `main` (production)

- ✅ Require pull request from `staging` only (manual promotion via Vercel "Promote to Production" button)
- ✅ Restrict who can push (admins only)
- ✅ Require linear history
- ❌ No agent push allowed (Symphony agents target `development` only — enforced via `WORKFLOW.md` constraint, not branch protection)

## Notes

- GitHub default branch remains `main`. Symphony explicitly targets `development` via `gh pr create --base development` per the workflow prompt — keeps default-clone behavior intact for tools that assume `main`.
- Branch protection bypass for admins: keep enabled for emergency hotfixes; document any bypass in a Linear ticket within 24h.
