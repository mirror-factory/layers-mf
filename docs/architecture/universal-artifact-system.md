# Universal Artifact System — Architecture Document

> Status: Phase 3 In Progress (DB + Tools done, Panel next)
> Owner: Mirror Factory (Alfonso, Kyle, Bobby)
> Last updated: 2026-04-02
>
> **Completed:**
> - Phase 1: DB migration (artifacts, artifact_versions, artifact_files tables)
> - Phase 2: Tool updates (write_code, create_document, edit_document, run_project)
> **In Progress:**
> - Phase 3: Panel upgrades (version history, inline editing, API endpoints)

---

## 1. Overview

The Universal Artifact System is Granger's core content creation and management layer. It handles everything the AI creates during conversations — code files, documents, sandbox applications, data visualizations, and more — with full version history, editing, cost tracking, and search.

**Key principle:** Every artifact is a first-class object with its own identity, version history, metadata, and lifecycle — regardless of whether it's a Python script, a rich text document, or a full React application.

---

## 2. Current State (As-Is)

### 2.1 How Artifacts Are Created Today

| Tool | What it creates | Storage | Editable | Versioned |
|------|----------------|---------|----------|-----------|
| `write_code` | Code files (JS, Python, HTML, etc.) | `context_items` (source_type="code") | No | No |
| `create_document` | Rich text documents | `context_items` (source_type="document") | Yes (TipTap) | Yes (`document_versions`) |
| `edit_document` | Edits existing documents | Updates `context_items.raw_content` | Yes | Creates version |
| `run_project` | Multi-file sandbox apps | `context_items` (source_type="code") + `sandbox_snapshots` | No | Snapshots only |
| `run_code` | Single-file execution | `context_items` (source_type="code") | No | No |

### 2.2 Current Database Schema

**`context_items`** — Primary storage (shared with ingested external docs)
```sql
id, org_id, source_type, source_id, title, raw_content,
description_short, description_long, content_type, entities,
embedding, status, source_metadata, ingested_at, processed_at,
priority_weight, confidence_score, search_tsv, content_hash
```

**`document_versions`** — Version history for documents only
```sql
id, context_item_id, version_number, title, content,
edited_by, change_summary, created_at
```

**`sandbox_snapshots`** — Sandbox state persistence
```sql
id, snapshot_id, org_id, name, metadata,
cpu_usage_ms, network_ingress_bytes, network_egress_bytes,
created_at, updated_at
```

**`sandbox_usage`** — Cost tracking for sandbox compute
```sql
id, org_id, user_id, sandbox_id, cpu_ms, memory_mb_seconds,
network_ingress_bytes, network_egress_bytes, cost_usd, created_at
```

### 2.3 Current Artifact Panel (Right Side of Chat)

```
+-------------------+---------------------------+
| File Tree         | Header                    |
| (collapsible)     | [Code] [Preview] [Live]   |
|                   | [Open tab] [Restart]      |
| src/App.jsx       |                           |
| src/main.jsx      | CodeBlock (syntax hl)     |
| package.json      |    OR                     |
|                   | TipTapEditor (rich text)  |
|                   |    OR                     |
|                   | iframe (sandbox preview)  |
+-------------------+---------------------------+
```

### 2.4 Current Limitations

1. **No dedicated artifacts table** — artifacts share `context_items` with ingested external docs (Google Drive files, Slack messages, etc.)
2. **Code artifacts are read-only** — can view but not edit inline
3. **No version history UI** — `document_versions` exists but no way to browse/compare/restore
4. **No diff view** — can't compare versions side by side
5. **Artifact files lost on refresh** — the `files` array is in React state only, not persisted to DB
6. **No cost tracking per artifact** — sandbox costs exist in `sandbox_usage` but not linked to artifacts
7. **No fork/duplicate** — can't clone artifacts
8. **No sharing** — can't generate a link to share an artifact
9. **No pop-out window** — can't detach artifact to separate browser window
10. **Sandbox projects can't be edited** — only restarted from snapshot
11. **No tags/categories on artifacts** — only on context_items (which has `entities` JSON)
12. **No multi-level descriptions** — just `description_short` and `description_long`
13. **AI can't browse version history** — no tool to list/compare artifact versions
14. **No approval flow for edits** — document edits happen immediately, no review step

---

## 3. Target State (To-Be)

### 3.1 New Database Schema

**`artifacts`** — Dedicated artifact table
```sql
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),

  -- Identity
  type TEXT NOT NULL CHECK (type IN ('code', 'document', 'sandbox', 'csv', 'image', 'html')),
  title TEXT NOT NULL,
  slug TEXT, -- URL-friendly identifier

  -- Content
  current_version INT NOT NULL DEFAULT 1,
  primary_file_path TEXT, -- e.g., "src/App.jsx" for the main file

  -- Metadata at multiple context lengths
  description_oneliner TEXT, -- ~10 words, for lists and badges
  description_short TEXT, -- ~50 words, for cards and search results
  description_long TEXT, -- ~200 words, for detail pages and AI context

  -- Classification
  tags TEXT[] DEFAULT '{}', -- user-defined tags
  categories TEXT[] DEFAULT '{}', -- auto-generated categories
  language TEXT, -- programming language or "richtext", "markdown"
  framework TEXT, -- "react", "vite", "python", "nextjs", etc.

  -- Cost tracking
  total_cost_usd NUMERIC(10,6) DEFAULT 0,
  total_input_tokens INT DEFAULT 0,
  total_output_tokens INT DEFAULT 0,

  -- Sandbox-specific
  snapshot_id TEXT, -- Vercel sandbox snapshot ID
  preview_url TEXT, -- last known preview URL
  run_command TEXT, -- e.g., "npm run dev"
  expose_port INT, -- e.g., 5173

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  is_pinned BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_opened_at TIMESTAMPTZ
);
```

**`artifact_versions`** — Universal version history
```sql
CREATE TABLE artifact_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_number INT NOT NULL,

  -- Content (stores the full state at this version)
  content TEXT, -- for single-file artifacts
  files JSONB, -- for multi-file: [{path, content}]
  snapshot_id TEXT, -- for sandbox: Vercel snapshot ID

  -- Metadata
  change_summary TEXT, -- AI-generated or user-provided
  change_type TEXT CHECK (change_type IN ('create', 'edit', 'ai_edit', 'fork', 'restore')),

  -- Cost of this version
  cost_usd NUMERIC(10,6) DEFAULT 0,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,

  -- Who made it
  created_by UUID REFERENCES auth.users(id),
  created_by_ai BOOLEAN DEFAULT false,
  model_used TEXT, -- e.g., "anthropic/claude-sonnet-4.6"

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(artifact_id, version_number)
);
```

**`artifact_files`** — Persistent file storage for multi-file projects
```sql
CREATE TABLE artifact_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_number INT NOT NULL,

  file_path TEXT NOT NULL, -- e.g., "src/App.jsx"
  content TEXT NOT NULL,
  language TEXT, -- detected from extension
  size_bytes INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(artifact_id, version_number, file_path)
);
```

### 3.2 Artifact Types

| Type | Examples | Editor | Preview | Versioning |
|------|----------|--------|---------|------------|
| `code` | JS, Python, SQL, YAML | Monaco-style inline editor | Syntax highlighted | Full content per version |
| `document` | Memos, specs, briefs | TipTap rich text editor | Rendered HTML | Full HTML per version |
| `sandbox` | React apps, APIs, dashboards | File tree + code editors | Live iframe preview | Snapshot + files per version |
| `csv` | Data tables, exports | Table editor | Formatted table | Full content per version |
| `image` | Generated images, screenshots | Image viewer | Image preview | Binary per version |
| `html` | Static pages, emails | Code editor | Live preview | Full content per version |

### 3.3 AI Capabilities (New Tools)

```
artifact_list       — List artifacts with filters (type, tag, search)
artifact_get        — Get artifact content + metadata + version history
artifact_edit       — Edit code/document with diff preview
artifact_version    — Browse/compare/restore versions
artifact_fork       — Duplicate an artifact
artifact_tag        — Add/remove tags and categories
artifact_describe   — Generate/update descriptions at all levels
```

### 3.4 Edit Workflow

**For documents (TipTap):**
1. AI calls `artifact_edit` with target text and replacement
2. Fuzzy match finds the section
3. New version created in `artifact_versions`
4. TipTap editor updates live
5. User can undo/redo, or restore previous version

**For code:**
1. AI calls `artifact_edit` with file path, line range, and new content
2. Diff preview shown in panel (green/red lines)
3. User approves or rejects
4. New version created if approved
5. If sandbox: auto-restart with new files

**For sandbox projects:**
1. AI calls `artifact_edit` with specific file changes
2. Changes applied to `artifact_files`
3. New version created with updated files
4. Sandbox restarts with new code
5. Snapshot saved after successful restart

### 3.5 Version History UI

```
+------------------------------------------+
| Version History                    [x]   |
|------------------------------------------|
| v5 (current) — 2 min ago                |
|   "Added dark mode toggle"               |
|   by AI (Claude Sonnet 4.6)    $0.003   |
|                                          |
| v4 — 15 min ago                          |
|   "Refactored header component"          |
|   by AI (Gemini Flash)         $0.001   |
|                                          |
| v3 — 1 hour ago                          |
|   "Added navigation sidebar"             |
|   by Alfonso (manual edit)     $0.000   |
|                                          |
| v2 — 2 hours ago                         |
|   "Initial scaffold + styling"           |
|   by AI (GPT 5.4)             $0.005   |
|                                          |
| v1 — 2 hours ago                         |
|   "Created"                              |
|   by AI (GPT 5.4)             $0.004   |
|                                          |
| [Compare v3 ↔ v5]  [Restore v3]        |
+------------------------------------------+
```

### 3.6 Multi-Level Descriptions

Every artifact gets descriptions at three context lengths:

| Level | Length | Used for | Example |
|-------|--------|----------|---------|
| `description_oneliner` | ~10 words | List views, badges, search results | "React dashboard with team metrics and charts" |
| `description_short` | ~50 words | Cards, artifact browser, AI context window | "A React + Vite dashboard showing team productivity metrics. Includes stat cards, line charts for weekly trends, and a team member grid. Uses Recharts for visualization and Tailwind CSS for styling." |
| `description_long` | ~200 words | Detail pages, full AI context, documentation | Full technical description including architecture, dependencies, key components, data sources, and usage instructions. |

These are auto-generated by AI on creation and updated on each edit.

### 3.7 Search & Discovery

Artifacts are indexed for search:
- **Vector embeddings** on `description_long` for semantic search
- **BM25 text search** on title + descriptions + tags
- **Faceted filters**: type, tags, categories, language, framework, date range
- **Smart suggestions**: "You edited this 3 times today" / "Related to your Linear sprint"

---

## 4. Implementation Phases

### Phase 1: Database Migration
- Create `artifacts`, `artifact_versions`, `artifact_files` tables
- Migrate existing `context_items` artifacts to new tables
- Add RLS policies for org-level access
- Generate new Supabase types

### Phase 2: Tool Updates
- Update `write_code` → create artifact + version 1
- Update `create_document` → create artifact + version 1
- Update `edit_document` → create new version
- Update `run_project` → create artifact + persist files
- Add new tools: `artifact_list`, `artifact_get`, `artifact_edit`, `artifact_version`, `artifact_fork`

### Phase 3: Panel Upgrade
- Inline code editing (not just viewing)
- Version history sidebar with compare/restore
- Diff view between versions
- Pop-out to new window
- Fork/duplicate button
- Cost badge per artifact

### Phase 4: Artifacts Page
- Type filter tabs
- Search within artifacts
- Bulk actions (archive, delete, tag)
- Cost column
- Sort options (recent, expensive, most edited)

### Phase 5: AI Integration
- Auto-generate descriptions at all levels
- Auto-tag based on content analysis
- Version summaries generated by AI
- AI can browse and compare versions
- Smart edit suggestions based on context

---

## 5. Key Files (Current)

| File | Purpose |
|------|---------|
| `src/lib/ai/tools.ts` | Tool definitions: write_code, create_document, edit_document, run_project, run_code |
| `src/lib/sandbox/execute.ts` | Sandbox execution: executeInSandbox, executeProject, snapshots, cost tracking |
| `src/components/chat-interface.tsx` | Artifact panel UI: file tree, code viewer, TipTap editor, preview iframe |
| `src/components/tiptap-editor.tsx` | Rich text editor for document artifacts |
| `src/components/file-tree.tsx` | File browser for multi-file projects |
| `src/components/ai-elements/code-block.tsx` | Syntax-highlighted code viewer |
| `src/components/content-viewer.tsx` | Universal content viewer (HTML, code, meetings, issues) |
| `src/app/(dashboard)/artifacts/page.tsx` | Artifacts browse page |
| `src/app/(dashboard)/context/[id]/page.tsx` | Individual artifact/context detail page |
| `src/app/api/sandbox/restart/route.ts` | Sandbox restart endpoint |
| `src/app/api/sandbox/demo/route.ts` | Sandbox demo page API |
| `src/lib/database.types.ts` | Supabase generated types |

---

## 6. Open Questions

1. **Should artifacts remain searchable via `search_context`?** Currently all artifacts go into `context_items` which has embeddings. If we move to a separate `artifacts` table, do we also create embeddings for artifacts?

2. **How do we handle the transition?** Existing artifacts in `context_items` need migration. Do we keep them in both tables during transition?

3. **Approval flow for AI edits?** Should AI-generated edits go through the approval queue, or are they applied immediately with undo capability?

4. **Real-time collaboration?** If two users are viewing the same artifact, should edits sync in real-time? (TipTap supports this via Yjs)

5. **Storage limits?** Multi-file sandbox projects can be large. Do we set per-org limits on total artifact storage?

6. **Embedding cost?** Generating embeddings for every artifact version could be expensive. Do we only embed the latest version?
