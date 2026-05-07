---
name: context7-first
description: Prefer current documentation before changing fast-moving libraries and platform APIs.
---

# Context7-First Skill

> Prefer current documentation over memory for fast-moving libraries and platform APIs.

## When to Use

- You are adding or changing shadcn/ui components
- You are using a new Next.js App Router API or route pattern
- You are working with Vercel AI SDK, AI Elements, AI Gateway, or Playwright APIs
- The local reference docs are missing, narrow, or obviously stale
- You are unsure about a library-specific prop, hook, install step, or integration detail

## Rule

1. Check whether the repo already has a clearly maintained local reference.
2. If it does not, or if the answer is ambiguous, use Context7 before coding.
3. Prefer verified docs over remembered snippets.

## Why

Lower-cost models improve when they stop guessing about fast-moving APIs.
This skill is part of the quality-first path: stricter process, fresher docs, fewer silent regressions.

## Common targets

- `shadcn/ui`
- `next.js`
- `@ai-sdk/*`
- `Playwright`
- `AI Elements`

## Expected behavior

- record which source you used
- update local authored docs when the project now depends on that pattern
- do not improvise component APIs when current docs are easy to retrieve
