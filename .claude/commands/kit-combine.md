---
description: "Orchestrate across multiple features -- combined SPEC + manifest plan"
argument-hint: "<feature-a>,<feature-b>[,<feature-c>...]"
---

# /kit-combine -- meta-plan across features

Use this when a change cuts across more than one existing feature (for
example: "wire onboarding to use the new billing provider"). Single-
feature loops (`/cycle`) assume one SPEC; `/kit-combine` reads several
SPECs + manifests at once and produces a combined plan so you do not lose
track of which acceptance criterion belongs to which feature.

## Steps

1. **Parse the argument.** `$ARGUMENTS` is a comma-separated list:
   `featureA,featureB` (no spaces required). Split on `,`, strip
   whitespace. Require at least two feature names. Each must name an
   existing `features/<name>/` directory with a `SPEC.md`. If any feature
   is missing, list them and stop.

2. **Read the inputs for every feature.** For each feature:
   - `features/<f>/SPEC.md` -- the full acceptance list
   - `features/<f>/TEST-MANIFEST.yaml` -- the flows that back each criterion
   - `features/<f>/IA.md` if present -- routes + user flows
   - `features/<f>/DESIGN-READY.md` if present -- design-gate status

3. **Aggregate.** Build an in-memory view:
   - total unchecked acceptance criteria across all features (the work)
   - route overlap -- if two features both touch `/settings`, flag it
   - shared vendors -- compare registry vendor lists; collisions usually
     mean the features must agree on a single client/wrapper
   - manifest overlaps -- flows with the same name in two manifests are
     either duplicate work or an integration seam

4. **Produce the combined plan.** Write (do not execute) a plan to
   `features/_combined/<feature-a>-<feature-b>-PLAN.md` (create
   `features/_combined/` if needed). Sections:
   - `## Scope` -- one-line summary of what changes across all features
   - `## Unchecked criteria (by feature)` -- grouped list with feature name
     as a header
   - `## Route overlap` -- any route declared in more than one feature
   - `## Vendor overlap` -- any registry vendor shared across features
   - `## Suggested build order` -- which feature's criteria should flip
     first to minimize revisit (dependency-driven, not alphabetical)
   - `## Risks` -- anything that looks like it needs a human call (e.g.
     conflicting acceptance wording across two features)

5. **Do NOT mint a run.** `/kit-combine` is planning only. The user drives
   each feature through `/kit-run` individually once they approve the
   combined plan. Combined runs are not a kit concept -- `run_id`
   correlates to one feature by contract.

## Output

```
COMBINED PLAN features/_combined/<a>-<b>-PLAN.md
  features:        <N>
  open criteria:   <N total across features>
  route overlap:   <list or 'none'>
  vendor overlap:  <list or 'none'>
  suggested order: <feature-a> -> <feature-b>
next:
  edit the plan if it missed something
  then /kit-run <feature-a> (follow the suggested order)
```

## Do not

- Merge SPEC files. Each feature keeps its own `SPEC.md` as the source of
  truth; the combined plan is a read-only overlay.
- Mint a shared run_id. One run == one feature.
- Write any `.tsx` or implementation code. This command is pure planning;
  execution happens through the per-feature loop afterwards.
