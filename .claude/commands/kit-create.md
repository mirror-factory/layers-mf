---
description: "Scaffold features/<name>/ with SPEC.md seeded from the kit template"
argument-hint: "<feature-name>"
---

# /kit-create -- new feature scaffold

Seed a new feature directory from the kit's `_SEED-SPEC.md` template so the
rest of the toolchain (`/kit-design`, `/kit-run`, `/cycle`, pre-push gates)
has a well-formed SPEC.md to read.

## Steps

1. **Validate the argument.** `$ARGUMENTS` must be a kebab-case feature name
   (`^[a-z][a-z0-9-]*$`). If it is empty or fails the regex, stop and ask
   for a valid name.

2. **Refuse to clobber.** If `features/$ARGUMENTS/SPEC.md` already exists,
   stop and tell the user to either pick a new name or edit the existing
   SPEC. Never overwrite.

3. **Copy the seed.** Read `templates/features/_SEED-SPEC.md` (kit-shipped
   template that every new feature starts from) and write it to
   `features/$ARGUMENTS/SPEC.md`. Create the `features/$ARGUMENTS/`
   directory if it does not exist. Set the top H1 to the feature name
   in title case.

4. **Inject open-question stubs.** The seed ships three `<!-- OPEN
   QUESTIONS: ... -->` lines. Leave them in place and append two more at the
   top of the file so the user sees them on open:

   ```
   <!-- OPEN QUESTIONS: scope boundaries -- what is explicitly OUT of the first pass? -->
   <!-- OPEN QUESTIONS: success signal -- how do we know this feature shipped correctly (metric, user outcome, screenshot)? -->
   ```

   These stubs are what `spec-enricher` reads next -- the more open questions
   the SPEC surfaces, the better the enriched draft that comes back.

5. **Create sibling placeholders.** Inside `features/$ARGUMENTS/` create:
   - `TEST-MANIFEST.yaml` copied from `templates/features/_SEED-TEST-MANIFEST.yaml`
   - `wireframes/` (empty dir; `/kit-design` populates it)
   - `.gitkeep` in `wireframes/` so git tracks the directory

6. **Do NOT run anything else.** No doctor, no design, no run. Those are
   explicit subsequent commands. This command is pure scaffold.

## Output

```
CREATED features/<name>/
  SPEC.md            (seeded from templates/features/_SEED-SPEC.md)
  TEST-MANIFEST.yaml (seeded from templates/features/_SEED-TEST-MANIFEST.yaml)
  wireframes/        (empty, populated by /kit-design)
next:
  edit features/<name>/SPEC.md to answer the OPEN QUESTIONS
  then /kit-design <name> to produce tokens + wireframes + IA
```

## Do not

- Overwrite an existing SPEC.md. Ever.
- Start the design pass. `/kit-design` is the next explicit step so the user
  reviews the SPEC and answers the open questions first.
- Write any `.tsx`, `.ts`, or code files. Scaffolding is strictly
  documentation + manifest stubs.
