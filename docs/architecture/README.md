# Granger Architecture Documentation

> Master index of all architecture documents and plans.
> Last updated: 2026-04-02

---

## Overview

Granger is an AI Chief of Staff platform for knowledge teams. These documents cover every system, from the chat interface to data infrastructure to deployment.

---

## Document Index

| # | Document | Status | Description |
|---|----------|--------|-------------|
| 1 | [Universal Artifact System](./universal-artifact-system.md) | Core Complete | Code, documents, sandboxes — creation, versioning, editing, cost tracking |
| 2 | [Accounts, Orgs & Sharing](./accounts-orgs-sharing.md) | Complete | Users, organizations, roles, RLS, content ownership, sharing model |
| 3 | [Brand Guide](./brand-guide.md) | Complete | Colors, fonts, NeuralDots animation, component patterns, inline HTML rules |
| 4 | [Tool Result Cards](./tool-result-cards.md) | Planning | Universal card component for all tool outputs, citation bar, hover previews |
| 5 | [Knowledge Library System](./knowledge-library-system-v2.md) | Research & Planning | Library viewer, AI classification, embeddings, connectors, search, sharing |

---

## What Was Built This Session (2026-04-01 to 2026-04-02)

### Total: 70+ commits pushed to main

### Chat Experience
- **Inline HTML rendering** — AI generates HTML/CSS/SVG that renders directly in chat messages
- **7 JS libraries** loaded for inline visuals (Chart.js, GSAP, anime.js, Rough.js, Zdog, confetti)
- **Visual frequency control** — off/low/medium/high toggle for inline visuals
- **NeuralDots animation** — SVG-based neural network avatar for AI messages
- **NeuralMorph** — canvas-based morphing between 25 formations (shapes, physics, geometric)
- **AI-driven avatar state** — avatar formation changes based on what tool the AI is running
- **Avatar emotions** — AI can express feelings via [emotion:happy] markers
- **AI-generated dot art** — `express` tool generates custom dot patterns via Flash Lite
- **Floating prompt card** — modern prompt input with backdrop blur and shadow
- **3 consolidated control buttons** — attach, context window, settings dropdown
- **Redesigned tool calls** — inline text with friendly labels, no bordered cards
- **Actions on all messages** — copy (subtle), branch (green), thumbs up (green), thumbs down (red)
- **Auto-expanding textarea** — grows as you type, max 200px
- **Better suggestion prompts** — 6 diverse examples with mint accent alternating
- **Slash command menu** — max 8 items, positioned above input
- **Context window bar** — pops up above prompt on toggle
- **Per-message cost estimate** — inline cost badge on assistant messages

### Universal Artifact System (5 phases complete)
- **Phase 1**: Database — `artifacts`, `artifact_versions`, `artifact_files` tables with RLS
- **Phase 2**: Tools — write_code, create_document, edit_document, run_project save to artifacts
- **Phase 3**: API — 6 endpoints (list, get, update, delete, versions, restore)
- **Phase 4**: Artifacts page — queries new tables, type filters, search, tags, cost badges
- **Phase 5**: AI tools — artifact_list, artifact_get, artifact_version

### Sandbox Improvements
- **Auto-dependency detection** — scans imports, adds to package.json
- **Auto-patch Vite allowedHosts** — ensures sandbox domains work
- **Smart main.jsx generation** — detects App file path and CSS imports
- **3x retry on create** — handles transient failures
- **Health check** — 90s polling with non-empty body verification
- **AI Gateway key injection** — sandbox apps can call AI models
- **Demo page** — /sandbox/demo with start/stop/restart

### Brand & Design
- **Mint color palette** — primary #34d399, full light/dark CSS variables
- **Space Grotesk** — modern sans-serif display font (replaced Playfair serif)
- **Pixel canvas hero** — animated particle background on home page
- **Sidebar** — collapsed by default, hover to expand, NeuralDots logo
- **Mobile bottom nav** — Home/Chat/Context/Inbox tabs
- **3-tier avatar states** — generating (fast), latest (normal), older (sparse)

### UI Polish
- **Sidebar height overflow fixed** — h-screen + sticky
- **Welcome dashboard** — hero greeting, stats, 3-column grid
- **14 explainer panels** — every page has collapsible help text
- **Settings hub** — unified /settings with sidebar nav, 10 sections
- **Keyboard shortcuts** — G+key navigation, ? overlay
- **Command palette** — 27 items (pages, settings, actions)
- **Context library info panel** — slide-over Sheet on item click
- **Universal content viewer** — HTML, code, meeting, issue, message renderers
- **Inbox redesign** — filter badges, priority indicators
- **Conversation list** — timestamps, search, active indicator

### Infrastructure
- **All 130 TypeScript errors fixed** — 0 remaining across all commits
- **Supabase types regenerated** — matches current DB schema
- **Token counter** — estimates, context windows, pricing for 9 models
- **Compaction middleware** — auto-summarizes at 80% context threshold
- **AI Gateway cost capture** — per-step cost from providerMetadata
- **Tool description compression** — ~500 tokens/request saved
- **All 9 models synced** — client model selector matches server ALLOWED_MODELS
- **Hardcoded Haiku replaced** — all background tasks use Flash Lite

### New Tools Built
| Tool | What it does |
|------|-------------|
| `ingest_github_repo` | Clone repo in sandbox, save files to context |
| `web_browse` | Fetch URL, extract text |
| `review_compliance` | Check content against all rules/priority docs |
| `artifact_list` | Search/filter artifacts |
| `artifact_get` | Get artifact with files and version count |
| `artifact_version` | List or restore artifact versions |
| `express` | AI-generated dot art inline in chat |

### Documentation Created
| Document | Contents |
|----------|----------|
| Universal Artifact System | Schema, types, edit workflows, version history, 5 phases |
| Accounts & Sharing | Account model, RLS, roles, connector sharing |
| Brand Guide | Colors, fonts, NeuralDots, component patterns |
| Tool Result Cards | Universal card spec, citations, hover previews |
| Knowledge Library v2 | 38 requirements, embeddings research, 10 phases |
| Session handoffs | 2 handoff documents for LLM continuity |

---

## Key Technical Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Inline visuals | Direct DOM (not iframe) | Iframes had unfixable height issues with sandbox attribute |
| JS in inline HTML | Allowed (direct execution) | Needed for Chart.js, GSAP. Risk is low (AI-generated, auth-protected) |
| Embeddings | Gemini text-embedding-005 (planned) | Free, competitive quality, smaller dimensions = faster pgvector |
| Avatar animation | Canvas (NeuralMorph) for morphing, SVG (NeuralDots) for static | Canvas needed for smooth per-frame position interpolation |
| Artifact storage | Dedicated `artifacts` table + still indexed in `context_items` | Clean separation but backward-compatible search |
| Model routing | All through Vercel AI Gateway | Single API key, unified billing, model fallbacks |
| Background model | Gemini 3.1 Flash Lite Preview | Cheapest, used for auto-titles, classifications, etc. |

---

## What's Next (Priority Order)

1. **Fix artifact auto-open** — AI retrieves artifacts but can't open them in panel
2. **Fix connector persistence** — MCP/API connections dropping
3. **Embeddings upgrade** — switch to Gemini, re-embed content
4. **AI classification pipeline** — auto-tag/describe every item on ingest
5. **Library UI overhaul** — Finder-style column view with filters
6. **Connectors page** — consolidated MCP+API, modern UI
7. **Google Drive selective import** — file picker, background processing
8. **Sharing system** — per-file permissions, cross-team search
9. **Tool Result Cards** — universal card component with citations
10. **NeuralDots refinement** — smoother animations, more formations
