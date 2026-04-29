---
description: "TDD red step -- write a failing test for the next unchecked acceptance criterion"
argument-hint: "(optional) criterion index, e.g. 2"
---

# /red -- TDD red step

You are running the **red** phase of the test-driven development cycle the kit
enforces via `scripts/check-tdd.ts`. The goal: pick the next unchecked
acceptance criterion for the current feature and encode it as a failing test.
Nothing else.

## Steps

1. **Resolve the feature.** Read `.ai-dev-kit/state/current-run.json`. The
   `feature` field names the active feature. If the file is missing, stop and
   tell the user to run `ai-dev-kit run features/<feature>/SPEC.md` first so a
   run_id exists.

2. **Pull the next acceptance criterion.** Read
   `features/<feature>/SPEC.md`. Find the `## Acceptance` section. Walk the
   checklist in order. The first `- [ ] ...` line is the target. If
   `$ARGUMENTS` is a number, use that 1-indexed item instead. If every item is
   checked, stop and say the feature is acceptance-complete.

3. **Locate the matching test file.** Check
   `features/<feature>/TEST-MANIFEST.yaml` -- each criterion maps to a test
   target under `flows:` or `contracts:`. If there is no mapping, create
   `tests/<feature>/<slug>.test.ts` with the kebab-case slug of the criterion
   text.

4. **Write a failing test that encodes the criterion.** Keep it minimal: one
   `describe`, one `it`, and enough assertions to make the failure precise.
   Do NOT write the implementation. Do NOT mark the criterion as checked --
   the acceptance box only flips when the full red → green → refactor cycle
   lands.

5. **Verify the test fails.** Run `npx vitest run <path>` and confirm the
   exit code is non-zero. If the test accidentally passes (because the spec
   already holds or the assertion is too weak), tighten the assertion before
   moving on.

6. **Append to the TDD log.** Open or create
   `.ai-dev-kit/state/tdd-log.jsonl` and append:

   ```json
   {"status":"red","ts":"<ISO 8601>","feature":"<name>","criterion":"<text>","test_path":"<path>","run_id":"<from current-run.json>"}
   ```

   One line per event. `check-tdd.ts` reads this file during pre-commit to
   confirm every implementation change has a preceding red.

## Output

Print one block to the user:

```
RED ok
  feature:   <name>
  criterion: <text>
  test:      <path>
  next:      /green (writes the minimal implementation)
```

## Do not

- Implement the feature. `/green` owns that.
- Edit `SPEC.md` checkboxes. `/cycle` flips them after refactor passes.
- Run the full suite -- only the new test. Pre-push runs the full suite.
