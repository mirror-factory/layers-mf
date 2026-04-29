# Library Layer Feature Spec

## Intent

Build Library Layer as the core architecture for Layers: a central context Library where content is ingested, organized, retrieved, acted on, and exposed to external agents through Dewey and MCP.

## Source Plan

Canonical plan: `docs/plans/library-layer.md`

## Problem

The current app has strong surfaces: chat, context, MCP connectors, skills, artifacts, sandboxes, schedules, sessions, sharing, portals, analytics, and approvals. The product risk is that these remain separate features instead of becoming one coherent system.

Library Layer makes the Library the shared substrate. Dewey becomes the resident assistant/librarian who helps humans and agents use it.

## Goals

- Make Library the core domain across chat, MCPs, artifacts, sandboxes, skills, schedules, and portals.
- Preserve existing systems and adapt them into the Library model.
- Add Dewey as a system-owned assistant actor surfaced through chat and curation flows.
- Define MCP ingestion modes: live lookup, save selected, and sync rule.
- Support images and assets as first-class Library content.
- Keep artifacts and sandboxes as the primary "act on content" workflow.
- Prepare Layers to expose Library/Dewey/actions as an MCP server.
- Use the AI starter kit gates to keep work documented, tested, observable, and reviewable.

## Non-Goals

- Do not remove chat.
- Do not remove artifacts or sandbox execution.
- Do not rebuild the data model from scratch in phase 1.
- Do not auto-ingest all MCP content by default.
- Do not make Dewey a normal human user.
- Do not expose unbounded external Library access.

## V1 Acceptance Criteria

- A Library domain adapter maps existing `context_items`, `collections`, `inbox_items`, tags, chunks, and artifacts into Library Layer language.
- Chat can save useful content into the Library.
- Dewey has a documented profile/config and appears as the assistant identity in chat.
- Inbox items can be curated into Stacks.
- MCP lookup results can be used live or explicitly saved.
- Library Items can reference assets.
- Artifact outputs can be saved back to the Library.
- Risky external writes route through approval policy.
- Test coverage exists for Library adapter behavior, Dewey retrieval/save behavior, MCP ingestion modes, and sandbox save-back.
- `/dev-kit` registries track the feature, changed surfaces, tests, and remaining gaps.

## Implemented In This Slice

- Additive schema migration for Library sources, assets, relationships, context packs, Dewey profiles, MCP import batches, MCP sync rules, external-call audit logs, and MCP connection health/tool snapshots.
- Library domain service over existing context items and collections.
- API routes for Library Items, search, Stacks, assets, context packs, Dewey profile, MCP ingestion modes, and Layers MCP tools.
- Dewey product identity in chat prompts while preserving legacy Granger code naming.
- Chat tools for saving to Library, listing Stacks, and creating context packs.
- Approval-gated stubs for externally requested artifact and sandbox writes through the Layers MCP surface.
- First-class `/library` dashboard for Library metrics, recent items, MCP connections, context packs, sync rules, Stacks, approvals, and Dewey status.
- Inbox-to-Stack curation API route.
- Artifact save-back API route and automatic sandbox-run save-back.
- Route tests for MCP ingestion modes, Inbox curation, and artifact save-back.
- Temporary Library migration type shim until generated Supabase types are refreshed.

## Remaining V1 Gaps

- User-facing inline Library/Dewey curation UI beyond the dashboard and API routes.
- Fake MCP servers and OAuth/reconnect integration tests beyond the route-level mode tests.
- Asset upload/OCR/caption pipeline and search integration.
- Sandbox provider abstraction, cost accounting, and save-back UI.
- External MCP client OAuth/auth and transport hardening.
- Generated Supabase type refresh after migration apply.
- RLS/security tests and the full chat-to-sandbox-to-Library E2E flow.

## Testing Requirements

- Unit tests for Library adapter mapping and permission checks.
- Integration tests for Inbox to Stack curation.
- Tool tests for Dewey retrieval, save-to-library, and context-pack creation.
- Fake MCP server tests for live lookup, save selected, sync rule, token refresh, and reconnect behavior.
- Asset tests for upload, generated image metadata, thumbnail/OCR/caption persistence, and searchability.
- Artifact/sandbox tests for create, version, run, and save-back.
- E2E test for chat to Library retrieval to artifact to sandbox to Library save.
- RLS/security tests for cross-user and cross-org isolation.

## Implementation Notes

- Use existing tables before adding replacements.
- Prefer additive schema changes.
- Keep portal work separate.
- Keep product naming moving toward Dewey and Library while allowing Granger as legacy/internal code naming during transition.
- Update this spec as implementation decisions are locked.
