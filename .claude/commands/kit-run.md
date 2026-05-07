---
description: "Invoke `ai-dev-kit run features/<name>/SPEC.md` from inside Claude Code"
argument-hint: "<feature-name>"
---

# /kit-run -- start a run for the named feature

Thin wrapper around the kit's CLI `ai-dev-kit run`. Minting a run is what
populates `.ai-dev-kit/state/current-run.json` (the file every other
command -- `/red`, `/green`, `/cycle`, and the hooks -- reads to know which
feature is active). Without a current run, the TDD cycle has no context.

## Steps

1. **Validate the argument.** `$ARGUMENTS` must name an existing feature:
   `features/$ARGUMENTS/SPEC.md` must exist. If not, tell the user to run
   `/kit-create $ARGUMENTS` first and stop.

2. **Check the design gate.** Read `features/$ARGUMENTS/DESIGN-READY.md`.
   If missing, stop and tell the user to run `/kit-design $ARGUMENTS`
   first. The pre-build gate refuses to start a run when tokens and
   wireframes are not in place.

3. **Check that the SPEC has unchecked acceptance criteria.** If every
   `- [ ]` in `## Acceptance` is already `- [x]`, stop and tell the user
   this feature is acceptance-complete; there is nothing to run.

4. **Invoke the CLI.** Run:

   ```
   npx ai-dev-kit run features/$ARGUMENTS/SPEC.md
   ```

   Stream its output so the user sees the run_id on stdout. The CLI:
   - mints a ULID-sortable `run_id`
   - writes `.ai-dev-kit/state/current-run.json` (`{ run_id, feature, started_at }`)
   - records the run in `.ai-dev-kit/state/runs/history/<run_id>.json`
   - tags subsequent logs/costs/tests with that `run_id` so
     `/dev-kit/runs/<run_id>` can aggregate them

5. **Surface the run_id.** After the CLI returns, print the run_id and the
   dashboard URL to chat so the user can jump to it.

## Output

```
RUN started
  feature: <name>
  run_id:  <ULID>
  state:   .ai-dev-kit/state/current-run.json
  view:    /dev-kit/runs/<run_id>
next:
  /cycle      (drive the first acceptance criterion)
  /red        (manual red-only, if you prefer per-phase control)
```

## Do not

- Invoke `ai-dev-kit run` with a raw string -- always point it at a real
  SPEC.md path so the CLI can validate it.
- Re-run for a feature that already has an open run. Check
  `.ai-dev-kit/state/current-run.json` first; if `feature` matches and
  the run is still open, point the user at `/cycle` instead of starting a
  second run.
- Mint a run when the design gate is unmet. The pre-build gate rejects it
  anyway -- fail fast here rather than after the CLI bails.
