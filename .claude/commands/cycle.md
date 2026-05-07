---
description: "Drive one complete red -> green -> refactor cycle for the next acceptance criterion"
argument-hint: "(optional) criterion index to target"
---

# /cycle -- one full TDD cycle

You are running a complete red -> green -> refactor loop for the next
unchecked acceptance criterion of the currently active feature. The
individual `/red`, `/green`, and `/refactor` commands each do a single
phase; `/cycle` sequences them and, on success, flips the SPEC checkbox.

## Steps

1. **Pre-flight.** Read `.ai-dev-kit/state/current-run.json`. If missing,
   tell the user to start a run via `ai-dev-kit run features/<feature>/SPEC.md`
   or `/kit-run <feature>` and stop.

2. **Pick the criterion.** Read `features/<feature>/SPEC.md` `## Acceptance`.
   Select the first `- [ ] ...`; if `$ARGUMENTS` is a number, use that
   1-indexed row. Do not pick the standing gates (`Design approved`,
   `All routes declared...`, `Full test suite green`, `Budget within limits`,
   `Brand compliance LLM-judge >= 0.7`) -- those are enforced by hooks and
   are not one-per-cycle items.

3. **Run /red.** Execute the `/red` flow: write the failing test, verify it
   fails for the right reason, append `status:"red"` to
   `.ai-dev-kit/state/tdd-log.jsonl`. If the test passes on first run,
   tighten the assertion until it fails for the intended reason before
   moving on.

4. **Run /green.** Execute the `/green` flow: write the minimum
   implementation, rerun the targeted test, confirm it passes, append
   `status:"green"` to the TDD log.

5. **Run /refactor.** Execute the `/refactor` flow: clean up without
   changing behavior, rerun `npx vitest related <impl_paths> --run`,
   append `status:"refactor"` to the TDD log.

6. **Flip the SPEC box.** Edit `features/<feature>/SPEC.md`: replace the
   `- [ ]` in front of the chosen criterion with `- [x]`. Leave every other
   line untouched.

7. **Summarize and stop.** Do NOT start the next cycle -- one `/cycle` run
   = one criterion. Point the user at `/cycle` again or at `/kit-status` to
   see what is left.

## Output

```
CYCLE ok
  feature:   <name>
  criterion: <text>              [flipped to [x] in SPEC.md]
  red:       <test path>
  green:     <impl paths>
  refactor:  <summary>
  remaining: <N unchecked criteria>
  next:      /cycle (next criterion) | /kit-status (overview)
```

## Do not

- Skip the refactor phase. If there is nothing to clean, note it in the log
  and move on, but do not claim cycle success without having run
  `vitest related`.
- Flip the SPEC checkbox before all three phases pass. A half-done cycle
  leaves the box unchecked so the next `/cycle` resumes cleanly.
- Chain two cycles together. One invocation = one criterion. This keeps the
  log honest and makes audit-rebuild's silent-regression detection
  actionable.
