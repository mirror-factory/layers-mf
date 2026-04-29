# Vendor Registries

This directory holds JSON files — one per external vendor the project integrates with — that list the valid model IDs, pricing, and deprecation patterns for that vendor. Every project populates its own registries as it adds integrations. **The kit does not ship a curated list.** What works for an audio-transcription app (AssemblyAI, Deepgram) is different from what works for a marketing-copy app (OpenAI, Anthropic).

## Why this exists

The AssemblyAI `speech_model` → `speech_models` incident shipped because a string literal was hardcoded into source with no validation. The kit now forces every vendor model string through a registry. Three enforcement layers:

1. **Pre-commit (`scripts/check-registry-strings.ts`)** — scans source for any literal matching a registered vendor's `id_patterns`. Fails the commit if the match isn't present in the registry.
2. **Runtime (`lib/registry.ts`)** — `validModels('<vendor>', '<slot>')` and `assertValidModel(...)` validate at call time, not just at commit.
3. **Doctor** — warns on registries older than 90 days (`validated_on` field); re-validation with `ai-dev-kit registry refresh <vendor>`.

## Adding a new vendor

The fast path:

```
ai-dev-kit registry add <vendor>
```

This scaffolds a new registry by:

1. Asking the vendor's docs URL and SDK package name
2. Delegating to the `spec-enricher` subagent to Context7-fetch the current docs
3. Writing `.ai-dev-kit/registries/<vendor>.json` with a seeded list of models, pricing, provenance URLs, and `validated_on` set to today
4. Running doctor to confirm the new registry parses

The slow path (manual): copy `registry.schema.json` for reference, create a new file, fill in the sections below.

## Shape

Full schema in `registry.schema.json`. Minimum required fields: `vendor`, `label`, `validated_on`. At least one `*_models` slot (e.g. `chat_models`, `batch_models`, `streaming_models`, `embedding_models`, `speech_models`, `tts_models`, `image_models`). Each model entry needs `id`, `label`, `deprecated`.

Optional but strongly encouraged:

- `id_patterns` — regex patterns that match the vendor's model IDs. Without this, the pre-commit scanner can't detect hardcoded strings that weren't explicitly validated.
- `provenance` — URLs where each section was verified.
- `deprecations` — known-bad patterns to auto-flag.
- Pricing fields per model entry.

## What goes in, what doesn't

**Goes in:**
- Every vendor the project actually imports (`assemblyai`, `@ai-sdk/openai`, `langfuse`, etc.)
- Every model ID the project might pass on the wire
- Current pricing, tagged with a `validated_on` date

**Doesn't go in:**
- Unused vendors — if you aren't calling the vendor, don't ship a registry
- Secrets — env var _names_ are fine (they're code); values never go here
- Implementation details — this is the contract, not the wiring

## Project-DB sync (optional)

Registries are filesystem-first and version-controlled. For teams who want centralized visibility across many projects, the `ai-dev-kit registry sync` command (future) mirrors these files into a Supabase `project_registries` table tagged by project. Not required; most projects live with just the filesystem copy.
