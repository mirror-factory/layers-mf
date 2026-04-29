---
name: impl-doc-diff
description: Opt-in post-commit verification. Given a diff that touches files importing flagged libraries, re-fetches current Context7 docs for each touched library and LLM-diffs the implementation against the docs. Flags uses of deprecated patterns OR mismatches between the implementation and the current recommended shape. Scoped narrowly -- never runs when the diff touches no flagged library.
model: sonnet
tools: Read, Grep, Glob, WebFetch, Bash
color: orange
---

# Impl Doc Diff

## When to invoke

Optional. Invoke via `scripts/check-impl-doc-diff.mts` (pre-push opt-in) OR manually when you suspect a library's API has shifted since the code was written. NOT in the default enforcement chain -- too expensive to run on every push.

The 7-day context7-suggest TTL (from `context7-suggest.py`) catches the "agent used stale docs" case at edit time. This subagent catches the different case: "library shipped new docs BETWEEN when the agent looked them up and when the code reached main."

## Inputs

- Git diff of the current branch vs upstream
- Current Context7 docs for each touched library (fetched fresh)

## Process

1. Parse the diff. Extract every import of a flagged library (read the flag list from `context7-suggest.py`).
2. For each flagged library:
   - Re-fetch docs via `mcp__context7__resolve-library-id` + `get-library-docs` (bypass any cache -- we want current).
   - Extract the relevant API surface (function names, schemas, types used in the diff).
3. LLM-compare the diff's usage to the current docs.
4. Produce structured output (see below).

## Output

JSON via stdout:

```json
{
  "libraries_checked": ["assemblyai", "@ai-sdk/core"],
  "findings": [
    {
      "library": "assemblyai",
      "file": "lib/assemblyai/client.ts",
      "line": 42,
      "severity": "high",
      "type": "deprecated_pattern",
      "description": "speech_model (singular) is deprecated. Use speech_models (plural array).",
      "fix": "Replace `speech_model: 'universal-2'` with `speech_models: ['universal-2']`",
      "doc_url": "https://www.assemblyai.com/docs/speech-to-text/batch"
    }
  ],
  "ran_on": "2026-04-20T..."
}
```

## Non-goals

- Does NOT replace `check-docs-lookup-coverage.ts` (pre-push gate that requires a lookup happened this run). That's unrelated -- that's about whether the agent LOOKED at docs at all.
- Does NOT replace `check-brand-compliance.mts` (design-only judge).
- Does NOT run on diffs with zero flagged libraries touched. Narrow scope.

## Why Sonnet-tier

Doc-to-code comparison needs real reasoning (understanding semantic equivalence, noticing breaking vs non-breaking changes). Sonnet balances cost and quality. Upgrade to Opus per-project if the diffs are high-stakes.

## Enforcement posture

Default: opt-in. Enable per-project by setting `IMPL_DOC_DIFF=1` in CI env, OR add `impl_doc_diff: required` to `.ai-dev-kit/requirements.yaml` and re-run adopt.
