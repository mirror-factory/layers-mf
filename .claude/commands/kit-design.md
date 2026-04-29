---
description: "Invoke the @design-agent subagent flow for the named feature"
argument-hint: "<feature-name>"
---

# /kit-design -- design-first pass

Hand the feature off to the `@design-agent` subagent defined in
`.claude/agents/design-agent.md`. That subagent owns brand tokens + ASCII
wireframes + IA; this command is a thin wrapper that routes the user
through it with the right inputs.

## Steps

1. **Validate the argument.** `$ARGUMENTS` must name an existing feature
   directory: `features/$ARGUMENTS/SPEC.md` must exist. If not, tell the
   user to run `/kit-create $ARGUMENTS` first and stop.

2. **Pre-flight the SPEC.** Read `features/$ARGUMENTS/SPEC.md`. If any
   `<!-- OPEN QUESTIONS: ... -->` line still contains a `?`-style stub
   (i.e. the user has not answered it), stop and list the unanswered
   questions. The design agent will refuse a SPEC with unanswered brand
   direction anyway, so this fails fast.

3. **Invoke the subagent.** Use the Task tool to invoke
   `@design-agent` with the feature name as context. The subagent's
   contract (see `.claude/agents/design-agent.md`):
   - reads `features/$ARGUMENTS/SPEC.md`, `.ai-dev-kit/registries/design-tokens.yaml`,
     `.ai-dev-kit/registries/pages.yaml`, `docs/brand-guide.md`
   - writes tokens into `.ai-dev-kit/registries/design-tokens.yaml`
   - extends `.ai-dev-kit/registries/design-system.yaml`
   - writes one ASCII wireframe per route to `features/$ARGUMENTS/wireframes/`
   - writes `features/$ARGUMENTS/IA.md`
   - writes `features/$ARGUMENTS/DESIGN-READY.md` on handoff

4. **Wait for the subagent.** Do not do any of the above work yourself -- the
   design agent's role declaration is the source of truth for the work
   product. Your job as the slash command is to invoke, wait, and report.

5. **Verify the handoff.** After the subagent returns, confirm:
   - `features/$ARGUMENTS/DESIGN-READY.md` exists
   - `.ai-dev-kit/registries/design-tokens.yaml` was updated
   - `features/$ARGUMENTS/wireframes/` has at least one `.txt` file
   - `features/$ARGUMENTS/IA.md` exists

   Missing any of those = the design agent bailed early. Surface the reason
   to the user (typically unanswered brand direction) and stop.

## Output

```
DESIGN ready features/<name>/
  tokens:      <N> colors, <N> typography, <N> spacing steps
  wireframes:  <N> routes
  IA:          <N> user flows
  DESIGN-READY.md written at <ISO>
next:
  /kit-run <name>   (begin the build loop)
  /cycle            (drive first acceptance criterion)
```

## Do not

- Write tokens, wireframes, or IA yourself. Always delegate to `@design-agent`.
- Touch `.tsx` or any component code. Design is pre-implementation by
  contract; the next step is `/kit-run` or `/cycle`, not scaffolding.
- Pretend `DESIGN-READY.md` exists when the subagent bailed. The whole
  point of the gate is that it is empirically verified.
