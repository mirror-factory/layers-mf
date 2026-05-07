---
# Symphony WORKFLOW configuration. Versioned in repo; deployed to /etc/symphony/.
tracker:
  kind: linear
  active_states: ["Todo", "In Progress"]
  terminal_states: ["Done", "Cancelled"]
  pickup_filter:
    require_label: "agent:codex"
    forbid_label: "human-only"

orchestrator:
  poll_interval_seconds: 30
  concurrency: 2
  retry_backoff_seconds: [1, 2, 4, 8, 60]
  max_retries: 5

worker:
  agent: codex-app-server
  budget_per_ticket_usd: 5
  budget_weekly_soft_usd: 200
  budget_weekly_hard_usd: 400

workspace:
  root: /var/symphony/workspaces
  hooks:
    after_create:
      - "git clone {{ project.repo }} ."
      - "git checkout -b agent/{{ ticket.identifier }}-{{ ticket.slug }}"
      - "pnpm install --frozen-lockfile"
      - "cp /etc/symphony/secrets/.env.layers-dev .env.local"
      - "export TICKET_HASH={{ ticket.identifier }}"
      - "node scripts/pick-dev-port.mjs > .ticket-port"
      - "npx ai-dev-kit run-tier 0 1"
    before_run:
      - "echo 'Tier 0+1 baseline established for {{ ticket.identifier }}; dev port = '$(cat .ticket-port)"
    after_terminal:
      - "rm -rf {{ workspace.path }}"

---

# Workflow prompt (delivered to every Codex worker)

You are a coding agent working on ticket **{{ ticket.identifier }}: {{ ticket.title }}**.

## Your objective

Get this ticket from `{{ ticket.state }}` to **In Review** with:

1. A green PR open against the `development` branch.
2. A Chrome DevTools video walkthrough attached as a Linear comment.
3. The ticket's Linear status transitioned to `In Review`, with the PR link
   commented on the ticket.

## How

1. Read the full ticket description and acceptance criteria via `linear_graphql`.
2. Plan your approach. Write a short plan as a Linear comment so a human can
   redirect you if your approach is wrong.
3. Write a failing test that captures the acceptance criteria. Run
   `pnpm test:fast` (Tier 1) and confirm it fails for the right reason.
4. Implement the change. Iterate (Ralph loop): make a change, run
   `pnpm test:fast`, fix what breaks, repeat until green.
5. Run `pnpm test:slow` (Tier 2) to validate end-to-end behavior.
   Iterate if anything fails.
6. Update the feature manifest if you added components, tools, APIs, or pages.
7. Commit, push, open a PR against `development` via `gh pr create`. Title
   should match the ticket title; body should reference the ticket key.
8. Record a Chrome DevTools video walkthrough demonstrating the change.
   Attach it as a Linear comment via `linear_graphql`.
9. Transition the ticket to `In Review` via `linear_graphql`.
10. Exit cleanly.

## Constraints

- Target branch is **always** `development`. Never push to `staging` or `main`.
- Per-ticket spend cap: ${{ worker.budget_per_ticket_usd }}.
- Tier 0/1/2 must all pass before opening the PR. Do not open a PR with
  failing gates.
- If you cannot complete the work in the budget, stop, file a comment
  explaining what's blocked, and exit. The orchestrator will mark
  `agent:failed` for human triage.

## Tools available (Layers default surface)

- Filesystem (your workspace only)
- `gh` CLI (PR ops, CI status, PR comments)
- `linear_graphql` (Linear API; orchestrator-held token, never exposed)
- `context7` MCP (library docs lookup — Vercel AI SDK v6, Next.js 16, shadcn/ui, etc.)
- Local Supabase preview branch (dev-tier service key only — see `.env.local`)
- Langfuse trace queries (read-only; for debugging your own model calls)

## Tools NOT available (unless ticket has the corresponding label)

- Web research (`agent:research-allowed` enables Firecrawl + WebSearch)
- Granola context (`agent:granola-context`)
- Google Workspace (`agent:google-workspace`)
- Cloudflare (`agent:cloudflare`)
- Supabase admin / write to non-preview branches (`agent:supabase-admin`)

If you need a tool that's not available, do not work around it. File a Linear
comment requesting the appropriate label and exit.

## Layers-specific notes

- **Source layout:** App Router under `src/app/`, components in `src/components/`,
  shared lib in `src/lib/`, types in `src/types/`. The `@/*` alias maps to `src/*`.
- **Layer boundaries enforced via ESLint:** `types → data → lib → components → app`.
  Don't import "up" the stack.
- **Dev server port:** `.ticket-port` (set by `after_create`) tells you which port
  to use. Run `pnpm dev` (already wired to read `pick-dev-port.mjs`) — the
  Cloudflare Tunnel will route `<ticket-id>.preview.layers.hustletogether.com`
  to your port via Vercel preview deploys; no manual proxy setup needed.
- **Observability:** all model calls flow through `src/lib/ai-call.ts` →
  `recordModelCall` → Langfuse. Query your own ticket's traces at
  `LANGFUSE_HOST`/traces?ticketId={{ ticket.identifier }} when debugging.
- **Branch protection on `development`:** PRs require Tier 0/1/2 green. The
  Tier 2 (Playwright) job runs in CI; do not skip it locally.
