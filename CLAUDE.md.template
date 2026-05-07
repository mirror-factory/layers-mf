# Claude Code — Project Context

Claude Code loads this file automatically at session start. Every rule and reference the agent needs lives in **`AGENTS.md`**. This file is a thin pointer so both conventions are covered (Claude Code loads CLAUDE.md; every other editor loads AGENTS.md).

## Read AGENTS.md first

Before writing any code, reading any vendor SDK, or spawning any subagent, open `AGENTS.md` in full. Treat every section as contract:

- **Claude Code Subagents** — which subagent to delegate to for which job.
- **Claude Code Hooks** — what blocks you and when. The PreToolUse Context7 hook will reject edits to files importing flagged libraries without a fresh docs lookup. This is not a suggestion.
- **Key Artifacts** — where spec.md, sprint contracts, reviews, registries, and notify config live.
- **Observability** — which routes to call, which wrappers are mandatory.
- **Kit Catalog** — the full list of files the kit ships so you don't reinvent what already exists.

## Before you write a file

Run this check mentally: "Does the kit already ship this?" If the file you're about to create has a matching entry under the AGENTS.md "Kit Catalog" section, **copy the template instead of writing from scratch**. Reinventing a dashboard, a health route, or an observability layer the kit already ships is a documented failure mode — it cost a real project a 500 error with no logs and several hours of investigation.

## Before you claim done

- `pnpm typecheck && pnpm test` pass (pre-commit enforces).
- `ai-dev-kit doctor --strict` exits 0 (pre-push enforces).
- If you touched an `app/api/*/route.ts` file, you have performed a real `route-exercise` (curl the endpoint, `pnpm test:api`, or Playwright) — not just unit tests. The Stop hook will block you otherwise.

## Emergency bypass only

- `CONTEXT7_BYPASS=1` — suppress the PreToolUse Context7 block for one edit. Use only when the kit is wrong, not when you're impatient.
- `EVAL_SKIP=1` — skip the eval suite in a push. Use only during flakiness triage.
- Never bypass pre-commit with `--no-verify`. CI runs the same gates as a backstop.

---

_This file is maintained by `ai-dev-kit onboard`. Re-run that command after major kit upgrades to refresh the AGENTS.md Kit Catalog section._
