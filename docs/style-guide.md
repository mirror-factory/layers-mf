# Style Guide

## Product Surface Rules

Layers is an operational product. Build the actual workspace first: Library, Inbox, chat with Dewey, MCP connections, artifacts, approvals, and handoffs. Avoid marketing-style hero layouts inside authenticated product routes.

## Component Rules

- Prefer existing shadcn/ui primitives and local patterns.
- Use lucide icons for recognizable actions.
- Keep cards for repeated items, dialogs, and framed tools.
- Do not nest cards inside cards.
- Keep layout stable with explicit dimensions for boards, toolbars, lists, previews, and counters.
- Preserve portal-specific work as a separate track.

## Library UI

- Use "Library Item" in product copy even if the backing table is `context_items`.
- Use "Stack" in product copy even if the backing table is `collections`.
- Inbox is the default intake surface.
- Show provenance, source, permissions, and stack membership close to the item title.
- Saved assets need a thumbnail or type icon, extracted text/caption status, and source metadata.
- Context Packs should read like handoff manifests: scope, included items, constraints, and destination.

## Dewey UI

Dewey appears as the assistant in chat and as a system-owned participant in curation flows. Dewey is not a normal human account.

Dewey interactions should:

- cite Library Items when retrieving context,
- ask before saving or acting,
- distinguish temporary chat uploads from saved Library assets,
- propose actions before execution,
- show approval state for risky writes,
- state missing context plainly.

## MCP UI

Every MCP connection must show:

- provider/service name,
- OAuth or credential state,
- scopes,
- discovered tools snapshot,
- last health check,
- reconnect/reauth prompt,
- available ingestion modes: live lookup, save selected, sync rule.

Never auto-dump a connected service into the Library.

## Testing Expectations

- Unit and API tests cover domain behavior.
- Playwright covers critical authenticated user flows.
- Expect specs cover real interactive routes.
- React Scan and Million gates remain active for UI performance.
- Fake MCP servers cover OAuth, discovery, lookup, selected save, sync, reconnect, and health failures.
- RLS/security tests cover cross-user and cross-org isolation.

_Last reviewed: 2026-04-29._
