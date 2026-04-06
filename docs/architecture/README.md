# Layers Architecture Documentation

> Master index of all architecture documents and plans.
> Last updated: 2026-04-06

---

## Start Here

**[roadmap.md](./roadmap.md)** -- Single source of truth for what's built, what's partially built, and what's next. Read this first.

---

## Document Index

### Chat

| Document | Status | Description |
|----------|--------|-------------|
| [Context Engineering](./chat/context-engineering.md) | Active | System prompt caching, compaction, priority docs flow |

### Artifacts

| Document | Status | Description |
|----------|--------|-------------|
| [Universal Artifact System](./artifacts/universal-artifact-system.md) | Active | Code, documents, sandboxes -- creation, versioning, editing |
| [Artifact System v2](./artifacts/artifact-system-v2.md) | Active | Artifact types, tool registry, missing tools |

### Library

| Document | Status | Description |
|----------|--------|-------------|
| [Library Hub & Sharing](./library/library-hub-and-sharing.md) | Active | Product vision -- library as the central hub |
| [Content Organization](./library/content-organization.md) | Active | Collections, tags, smart filters, AI classification (technical) |
| [Ingestion Pipeline](./library/ingestion-pipeline.md) | RFC | Queue-based ingestion redesign |

### Sharing

| Document | Status | Description |
|----------|--------|-------------|
| [Sharing Permissions](./sharing/sharing-permissions.md) | RFC | Per-resource permissions model |

### Organization

| Document | Status | Description |
|----------|--------|-------------|
| [Org Permissions System](./organization/org-permissions-system.md) | Proposal | Multi-org, roles, guests |

### Integrations

| Document | Status | Description |
|----------|--------|-------------|
| [Connector Persistence](./integrations/connector-persistence.md) | Active | ConnectionManager, OAuth auto-refresh, token persistence |

### Notifications

| Document | Status | Description |
|----------|--------|-------------|
| [Notification Events](./notifications/notification-events.md) | Active | Notification event types and delivery |

### Platform

| Document | Status | Description |
|----------|--------|-------------|
| [Brand Guide](./platform/brand-guide.md) | Active | Colors, fonts, NeuralDots animation, component patterns |
| [Mobile App](./platform/mobile-app.md) | Active | Capacitor setup for native iOS/Android, PWA manifest |
| [Tool Result Cards](./platform/tool-result-cards.md) | Active | Universal card component for tool outputs, citation bar |
| [Auto-Registry Strategy](./platform/auto-registry-strategy.md) | Active | Convention-over-configuration auto-generation plan |

### Registries

| Document | Status | Description |
|----------|--------|-------------|
| [Tool Registry](./registries/tool-registry.md) | Active | Built-in tool catalog and MCP integrations |
| [DB Schema Reference](./registries/db-schema-reference.md) | Active | Database tables, columns, relationships |
| [API Reference](./registries/api-reference.md) | Active | API routes documentation |

### Historical

| Document | Status | Description |
|----------|--------|-------------|
| [Execution Plan](./execution-plan.md) | Historical | Sessions 1-2 epic tracking (13 epics, all complete) |

### Archived

These docs are superseded by newer documents. Kept for reference in `archive/`.

| Document | Superseded By |
|----------|--------------|
| [knowledge-library-system.md](./archive/knowledge-library-system.md) | knowledge-library-system-v2.md |
| [knowledge-library-system-v2.md](./archive/knowledge-library-system-v2.md) | content-organization.md + library-hub-and-sharing.md |
| [accounts-orgs-sharing.md](./archive/accounts-orgs-sharing.md) | org-permissions-system.md |
| [sharing-system.md](./archive/sharing-system.md) | sharing-permissions.md + library-hub-and-sharing.md |
| [diagrams.md](./archive/diagrams.md) | Inline Mermaid diagrams in newer docs |

---

## Generated Documentation

Auto-generated reference docs live in [`docs/generated/`](../generated/README.md):

| File | Source | Command |
|------|--------|---------|
| [tools.md](../generated/tools.md) | `src/lib/ai/tools/_metadata.ts` | `pnpm tools:generate` |

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
