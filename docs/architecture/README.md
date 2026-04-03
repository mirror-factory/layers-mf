# Granger Architecture Documentation

> Master index of all architecture documents and plans.
> Last updated: 2026-04-03

---

## Overview

Granger is an AI Chief of Staff platform for knowledge teams. These documents cover every system, from the chat interface to data infrastructure to deployment.

---

## Document Index

| # | Document | Status | Description |
|---|----------|--------|-------------|
| 1 | [Universal Artifact System](./universal-artifact-system.md) | Complete | Code, documents, sandboxes — creation, versioning, editing, cost tracking |
| 2 | [Accounts, Orgs & Sharing](./accounts-orgs-sharing.md) | Complete | Users, organizations, roles, RLS, content ownership, sharing model |
| 3 | [Brand Guide](./brand-guide.md) | Complete | Colors, fonts, NeuralDots animation, component patterns, inline HTML rules |
| 4 | [Tool Result Cards](./tool-result-cards.md) | Complete | Universal card component for all tool outputs, citation bar, hover previews |
| 5 | [Knowledge Library System](./knowledge-library-system-v2.md) | Complete | Library viewer, AI classification, embeddings, connectors, search, sharing |
| 6 | [Connector Persistence](./connector-persistence.md) | Complete | Root cause analysis, ConnectionManager, OAuth auto-refresh |
| 7 | [Context Engineering](./context-engineering.md) | Complete | Compaction middleware, system prompt caching, priority docs flow |
| 8 | [Sharing System](./sharing-system.md) | Complete | content_shares table, RLS, permission model, share dialog |
| 9 | [Mobile App](./mobile-app.md) | Complete | Capacitor setup for native iOS/Android, PWA manifest |
| 10 | [Execution Plan](./execution-plan.md) | Active | 13 epics, 40+ tasks, agent-assignable with acceptance criteria |

---

## Execution Status (2026-04-03)

### All 13 Epics

| # | Epic | Status | Key Deliverables |
|---|------|--------|-----------------|
| 1 | Artifact Auto-Open | ✅ Complete | artifact_get returns openable data, ToolCallCard auto-opens panel |
| 2 | Connector Persistence | ✅ Complete | MCPConnectionManager, OAuth auto-refresh, token persistence |
| 3 | Embeddings Upgrade | ✅ Complete | Gemini text-embedding-004 primary, OpenAI fallback |
| 4 | AI Classification | ✅ Complete | classifyContent() with Zod schema, cron processor |
| 5 | Library UI Overhaul | ✅ Complete | Finder-style 3-column, filters, tags, context menu |
| 6 | Connectors Page | ✅ Complete | Consolidated MCP+API, NeuralDots, read/write toggles |
| 7 | Drive Selective Import | 🔨 Building | File picker, background import, progress tracking |
| 8 | Sharing System | ✅ Complete | content_shares table, share dialog, "Shared with me" |
| 9 | Tool Result Cards | ✅ Complete | ToolResultCard component, citation bar, link preview API |
| 10 | Context Engineering | ✅ Complete | System prompt caching (5-min TTL), compaction verified |
| 11 | Chat UI Polish | ✅ Complete | Avatar fix, max-width, old avatar pulsating, skip ack |
| 12 | Skill Upload | ✅ Complete | .skill/.json upload on skills page |
| 13 | Mobile App | ✅ Complete | Capacitor config, PWA manifest, build docs |

---

## Session 1 (2026-04-01 to 2026-04-02): 70+ Commits

### Chat Experience
- Inline HTML rendering — AI generates HTML/CSS/SVG directly in chat
- 7 JS libraries for inline visuals (Chart.js, GSAP, anime.js, Rough.js, Zdog, confetti)
- Visual frequency control — off/low/medium/high
- NeuralDots + NeuralMorph avatar system (25 formations, emotions, tool-driven state)
- Floating prompt card, redesigned tool calls, message actions
- Slash command menu, context window bar, per-message cost

### Universal Artifact System (5 phases)
- Database: `artifacts`, `artifact_versions`, `artifact_files` with RLS
- Tools: write_code, create_document, edit_document, run_project → artifacts
- API: list, get, update, delete, versions, restore
- AI tools: artifact_list, artifact_get, artifact_version

### Infrastructure
- 0 TypeScript errors, 9 models synced, Flash Lite for background tasks
- Compaction middleware, AI Gateway cost capture, tool compression
- Supabase types regenerated

---

## Session 2 (2026-04-03): 13 Epics Executed

### New Systems Built
- **MCPConnectionManager** — singleton cache with auto-refresh
- **AI Classification Pipeline** — classifyContent() + cron processor
- **Gemini Embeddings** — primary with OpenAI fallback
- **Library UI** — Finder-style columns, filters, tags, context menu
- **Connectors Page** — consolidated MCP+API with NeuralDots
- **Sharing System** — content_shares, share dialog, permissions
- **Tool Result Cards** — universal card with citations
- **Context Caching** — in-memory 5-min TTL for system prompts
- **Drive Import** — file picker + background processing
- **Skill Upload** — .skill file parsing and import
- **Mobile App** — Capacitor for native iOS/Android

### Chat Polish
- Double avatar fix, old avatars → pulsating circle
- Chat max-width constraint, skipped interview acknowledgment

---

## Key Technical Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Inline visuals | Direct DOM (not iframe) | Iframes had unfixable height issues |
| Embeddings | Gemini text-embedding-004 | Free, 768 dims = faster pgvector |
| Avatar animation | Canvas (NeuralMorph) + SVG (NeuralDots) | Canvas for morphing, SVG for static |
| Artifact storage | Dedicated tables + context_items index | Clean separation, backward-compatible search |
| Model routing | All through Vercel AI Gateway | Single API key, unified billing |
| Background model | Gemini Flash | Cheapest for auto-titles, classifications |
| Mobile | Capacitor (not PWA-only) | Native App Store builds, zero UI rewrite |
| Sharing | content_shares table with RLS | Per-item permissions, viewer/editor/owner |
| Connection persistence | Module-level singleton + DB state | Survives warm starts, reconnects on cold starts |
