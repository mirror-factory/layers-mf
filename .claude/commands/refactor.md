---
description: "TDD refactor step -- clean up without changing behavior, confirm still green"
argument-hint: "(optional) file path to focus on"
---

# /refactor -- TDD refactor step

You are running the **refactor** phase. The last cycle left a green test.
Your job: tighten the implementation without touching behavior, then prove
nothing regressed by rerunning only the impacted tests.

## Steps

1. **Read the TDD log tail.** Open `.ai-dev-kit/state/tdd-log.jsonl`. Take the
   last `"green"` entry whose `feature` matches
   `.ai-dev-kit/state/current-run.json`. Its `test_path` plus `impl_paths`
   tell you the surface that just went green. If there is no matching green
   entry, stop and say so.

2. **Decide what to clean up.** Candidate refactors:
   - Extract the repeated literal from the green-phase code into a named
     constant or helper.
   - Move the helper next to the module it serves; do not create new top-level
     dirs.
   - Collapse duplication introduced across multiple green cycles.
   - Rename a symbol when the shape that emerged needs a better name.
   - Replace inline types with a shared type if another module already imports
     a similar shape.
   If `$ARGUMENTS` is a path, scope the refactor to that file.

3. **Preserve behavior.** The rule is: no test file should have to change.
   If you need to edit a test to keep it passing, you are changing behavior,
   not refactoring -- roll back and run a fresh red/green instead.

4. **Confirm still green.** Run the narrowest vitest invocation that proves
   no regression:

   ```
   npx vitest related <impl_paths> --run
   ```

   `vitest related` walks the dependency graph from the edited implementation
   files to every test that imports them, so you rerun exactly what the
   refactor could have broken. If that returns clean, the refactor is safe.

5. **Append to the TDD log.**

   ```json
   {"status":"refactor","ts":"<ISO 8601>","feature":"<name>","criterion":"<text>","files_touched":["<a>","<b>"],"notes":"<one-line reason>","run_id":"<...>"}
   ```

## Output

```
REFACTOR ok
  feature:   <name>
  criterion: <text>
  cleanup:   <one-line summary>
  tests:     <N related specs rerun, all green>
  next:      /cycle (flip SPEC checkbox + advance to next criterion)
```

## Do not

- Add new functionality. If it was not in the green, it is not in the refactor.
- Touch unrelated files that happen to be nearby. Drive-by cleanup is its own
  commit, not a refactor step.
- Skip the `vitest related` rerun. The whole point of refactor is proving you
  did not regress; without the rerun, you have not proved it.
- Flip the SPEC.md checkbox here -- `/cycle` owns that.
