---
description: "TDD green step -- write the minimal implementation to pass the last red test"
argument-hint: "(optional) test path to target"
---

# /green -- TDD green step

You are running the **green** phase. The last `/red` event in
`.ai-dev-kit/state/tdd-log.jsonl` names a failing test. Your job: write the
smallest change that makes it pass. Nothing else.

## Steps

1. **Read the TDD log tail.** Open `.ai-dev-kit/state/tdd-log.jsonl` and take
   the last line whose `status` is `"red"` and whose `feature` matches
   `.ai-dev-kit/state/current-run.json`. If `$ARGUMENTS` is a path, prefer
   the latest red entry whose `test_path` matches that path. If no red entry
   exists, stop and tell the user to run `/red` first.

2. **Read the failing test.** Open the `test_path` from the red entry. The
   test's imports point at the symbols your implementation must expose.
   Follow the imports to decide which files to create or edit.

3. **Write the minimum implementation.** Favor: new file that exports the
   expected symbols with the smallest body that satisfies the assertions.
   Do not generalize, do not add error handling the test did not ask for,
   do not touch unrelated files. Over-implementation is how TDD discipline
   decays; `/refactor` is where polish happens.

4. **Run the targeted test.** `npx vitest run <test_path>`. Loop:
   - If it fails, read the error and make the smallest correction. One
     correction per iteration.
   - If it passes, stop. Do not run the full suite -- pre-push owns that.

5. **Append to the TDD log.**

   ```json
   {"status":"green","ts":"<ISO 8601>","feature":"<name>","criterion":"<text>","test_path":"<path>","impl_paths":["<a>","<b>"],"run_id":"<...>"}
   ```

6. **Do not check the acceptance box yet.** Keep the SPEC.md `- [ ]` as-is.
   `/cycle` flips it after `/refactor` passes.

## Output

```
GREEN ok
  feature:   <name>
  criterion: <text>
  test:      <path>
  impl:      <file(s) changed>
  next:      /refactor (clean up without breaking the test)
```

## Do not

- Add features the test did not request.
- Edit other tests to make the red test pass.
- Run the full vitest suite. Targeted run only.
- Flip the SPEC.md acceptance checkbox.
