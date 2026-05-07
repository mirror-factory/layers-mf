# Brand Guide

## Brand

**Product name:** Layers

**Company:** Mirror Factory

**Product promise:** Layers is the company context library where agents learn the business, retrieve grounded context, and act with approval.

**Audience:** Professionals and small teams using AI as working infrastructure, not as a toy prompt box. They expect clarity, control, provenance, and speed.

**Voice**

- Use: precise, calm, concrete, operational, plain English.
- Avoid: hype, vague AI jargon, emoji, cute personality, and "magic" language.

**Core phrasing**

- Mirror Factory teaches humans and agents to work together.
- Layers is where your agents learn about you.
- Dewey is the resident Librarian.
- Library, Stacks, Items, Inbox, References, Handoffs, Context Packs.

## Visual Direction

Layers should feel like quiet infrastructure for serious agent work: dense enough for repeated use, clear enough for novices, and restrained enough to make data provenance and action state obvious.

Use the solarpunk accent family from the Mirror Factory direction:

| Token | Value | Usage |
| --- | --- | --- |
| `sun` | `#f5d547` | attention, pending, collect |
| `sky` | `#5cc3e6` | handoffs, connections, active assistant state |
| `leaf` | `#7dcf71` | saved, synced, healthy |
| `fog-50` | `#fafaf7` | primary text on dark surfaces |
| `fog-300` | `#9e9a8a` | secondary text |
| `fog-700` | `#2a2824` | subtle borders |
| `black` | `#000000` | presentation and high-focus surfaces |

Product UI does not need to be black by default. Dashboard surfaces should stay quiet, scan-friendly, and theme-aware. Reserve the high-contrast presentation palette for brand moments, launch surfaces, and focused library views.

## Typography

Use the repo's existing UI typography conventions. Favor readable sans-serif UI text with mono for IDs, metadata, sync state, and MCP/tool details.

Scale guidance:

- Page titles: compact and descriptive.
- Panels and cards: small headings, dense body copy.
- Tables and lists: optimize for scanning, not hero typography.
- Chat and Dewey: readable message text with citations and source chips.

## Interaction Principles

- The Library is the source of truth.
- Dewey should explain what it used, what it saved, and what it cannot know.
- MCP imports are explicit: live lookup, save selected, or sync rule.
- Risky writes require approval.
- Artifacts and sandboxes are work products that can be saved back to the Library.
- Every saved asset should have provenance.

## Accessibility And Responsiveness

- All icon-only controls need labels or tooltips.
- Keyboard navigation must work for Library curation, chat, MCP connection flows, and approvals.
- Do not rely on color alone for state.
- Text must fit in buttons, tabs, cards, and sidebars at mobile and desktop widths.

_Last reviewed: 2026-04-29._
