# Artifact System v2 — Full Architecture & Roadmap

> Status: Design Phase
> Owner: Mirror Factory
> Date: 2026-04-04
> Builds on: `docs/architecture/universal-artifact-system.md` (Phases 1-5 complete)

---

## 1. Artifact Types

### Current Types (DB supports)
| Type | Description | Editor | Preview | Versioned |
|------|-------------|--------|---------|-----------|
| **code** | Single-file scripts (JS, Python, HTML, CSS, SQL, etc.) | Syntax editor | Inline HTML render | Yes |
| **document** | Rich text (memos, specs, reports) | TipTap rich text | Rendered HTML | Yes |
| **sandbox** | Multi-file apps (React, Vite, Next.js, Python) | File tree + syntax editor | Live iframe preview | Yes + snapshots |
| **html** | Static pages, emails | Syntax editor | Inline render | Yes |
| **csv** | Data tables, exports | (planned) Table editor | Table view | Yes |
| **image** | Generated images, screenshots | (planned) Image viewer | Image display | Yes |

### Proposed New Types (from AI Elements)
| Type | Description | AI Elements Component | Use Case |
|------|-------------|----------------------|----------|
| **diagram** | Flowcharts, architecture diagrams | Canvas + Node/Edge | System design, workflows |
| **schema** | API endpoint documentation | SchemaDisplay | API docs, data models |
| **spreadsheet** | Interactive data grids | (custom) DataGrid | Financial models, comparisons |
| **presentation** | Slide decks | (custom) SlideViewer | Pitch decks, reports |
| **terminal** | Execution logs, build output | Terminal | CI/CD logs, debugging |

---

## 2. Current Tool Registry

### Creation Tools
| Tool | Creates | Type | Speed |
|------|---------|------|-------|
| `write_code` | Single code file | code/html | Instant |
| `create_document` | Rich text doc | document | Instant |
| `run_project` | Multi-file app with live preview | sandbox | ~5s (snapshot) / ~20s (cold) |
| `run_code` | Execute script, capture output | code | ~3-5s |

### Management Tools
| Tool | Action | Notes |
|------|--------|-------|
| `artifact_get` | Open artifact in panel | Fetches content + files for current version |
| `artifact_list` | Search/list artifacts | Filters by type, search, limit |
| `artifact_version` | List/restore versions | Creates new version on restore |
| `artifact_delete` | Soft delete | Sets status="deleted" |
| `artifact_panel` | Open/close side panel | Client-side, no execute |
| `edit_code` | Edit code artifact | Find-and-replace with fuzzy match, per-file targeting |
| `edit_document` | Edit doc artifact | Title change + content replace |

### Missing Tools (Proposed)
| Tool | Action | Why Needed |
|------|--------|------------|
| `artifact_context` | Load artifact into chat context | AI needs awareness of open/active artifact |
| `artifact_search` | Deep search across artifacts + versions | Find code patterns, content across all versions |
| `artifact_diff` | Compare two versions | Show what changed between v3 and v7 |
| `artifact_fork` | Clone artifact as new | "Make a copy of this and modify it" |
| `artifact_rename` | Rename file in multi-file project | Currently requires edit_code workaround |
| `artifact_add_file` | Add new file to existing project | Currently requires full run_project rebuild |
| `artifact_remove_file` | Remove file from project | No tool exists for this |

---

## 3. Artifact Context System

### Problem
The chat currently has NO awareness of which artifact is open. When a user says "edit line 5" or "change the color", the AI doesn't know what they're looking at.

### Solution: Artifact Context Injection

```
┌─────────────────────────────────────────────┐
│              System Prompt                   │
│                                              │
│  [base instructions]                         │
│  [org rules]                                 │
│                                              │
│  ## Active Artifact Context                  │
│  Currently viewing: "Retro Calculator" (v4)  │
│  Type: sandbox | Files: 7                    │
│  Open file: src/App.jsx (420 tokens)         │
│  ┌──────────────────────────────────┐        │
│  │ [truncated file content]         │        │
│  └──────────────────────────────────┘        │
│  Other files: index.html, index.css,         │
│  main.jsx, vite.config.js, package.json      │
│                                              │
│  Version history: v1 (create), v2 (edit),    │
│  v3 (ai_edit: "Added 80s theme"), v4 (edit)  │
│                                              │
│  [date/time context]                         │
└─────────────────────────────────────────────┘
```

### Implementation
1. **Client sends active artifact state** with each chat request:
   - `activeArtifactId`, `activeFilePath`, `artifactViewMode`
2. **Server injects artifact context** into system prompt:
   - Artifact metadata (title, type, version, file list)
   - Active file content (up to token budget)
   - Version history summary
3. **Context window tracker** shows artifact tokens as separate segment

### Token Budget
- Active file content: up to 2,000 tokens (~8KB)
- File list + metadata: ~200 tokens
- Version history summary: ~100 tokens
- **Total artifact context: ~2,300 tokens**

---

## 4. Artifact Editing by Type

### Code Artifacts
```
User: "change the background to blue"
  → AI calls edit_code(artifactId, targetText, replacement)
  → Creates version N+1
  → UI auto-refreshes with new content
```

### Document Artifacts
```
User: "rename this to 'Q3 Report'"
  → AI calls edit_document(documentId, newTitle: "Q3 Report")
  → Creates version N+1
  → TipTap editor reflects change

User: "add a section about revenue"
  → AI calls edit_document(documentId, targetText: "[end]", replacement: "## Revenue\n...")
  → Creates version N+1
```

### Sandbox Artifacts
```
User: "make the buttons round"
  → AI calls edit_code(artifactId, targetText, replacement, filePath: "src/App.jsx")
  → Creates version N+1 with updated file in artifact_files
  → UI shows updated code
  → "Restart" button triggers sandbox re-compile with new files

User: "add a dark mode toggle"
  → AI calls edit_code for App.jsx + edit_code for index.css
  → Two versions created (or batch in one)
  → Restart sandbox to see changes
```

### Sandbox Re-render Flow
```
┌──────────┐    ┌───────────┐    ┌──────────────┐
│ edit_code │ →  │ New       │ →  │ User clicks  │
│ (file)   │    │ version   │    │ "Restart"    │
└──────────┘    │ saved     │    └──────┬───────┘
                └───────────┘           │
                                        ▼
                               ┌──────────────┐
                               │ Load files   │
                               │ from latest  │
                               │ version      │
                               └──────┬───────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │ Sandbox.create│
                               │ (from snapshot│
                               │  + new files) │
                               └──────┬───────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │ Dev server   │
                               │ starts (~5s) │
                               │ Preview URL  │
                               └──────────────┘
```

---

## 5. Multi-Page Documents

### Concept
A document artifact can contain multiple "pages" — like a Google Doc with chapters or a Notion workspace with sub-pages. Stored as separate files in `artifact_files`, rendered with the same sidebar as code projects.

### Schema (Uses existing artifact_files table)
```
artifact_files:
  artifact_id: "doc-123"
  version_number: 1
  file_path: "01-executive-summary.html"    ← page 1
  file_path: "02-market-analysis.html"      ← page 2
  file_path: "03-financial-projections.html" ← page 3
  file_path: "04-appendix.html"             ← page 4
```

### UI: File tree sidebar shows pages
```
┌─────────────────┬──────────────────────────┐
│ PAGES           │ Executive Summary        │
│                 │                          │
│ ▸ Exec Summary  │ This document covers     │
│   Market        │ the Q3 2026 performance  │
│   Financials    │ of Mirror Factory...     │
│   Appendix      │                          │
│                 │ [TipTap rich text editor] │
│ + Add Page      │                          │
└─────────────────┴──────────────────────────┘
```

### Tools
- `create_document` gains `pages` param (array of { title, content })
- `edit_document` gains `filePath` param (which page to edit)
- `artifact_add_file` adds a page
- `artifact_remove_file` removes a page

---

## 6. Version & Revision System

### Current State
- Every edit creates a new version in `artifact_versions`
- Versions store: content, change_summary, change_type, cost, model, creator
- `artifact_version(action: "list")` returns all versions
- `artifact_version(action: "restore")` creates new version from old content

### Proposed Enhancements

#### a. Version Search
```
artifact_search(artifactId, query: "when did we add dark mode?")
  → Searches change_summary across all versions
  → Returns: "v3 (2026-04-02): Added dark mode toggle and theme CSS"
```

#### b. Version Diff
```
artifact_diff(artifactId, fromVersion: 3, toVersion: 7)
  → Returns unified diff showing additions/removals
  → UI renders with green/red highlighting
```

#### c. Version Timeline UI
```
v7 ● Current — "Fixed responsive layout" (AI, 2m ago)
v6 ● "Added dark mode" (AI, 1h ago)
v5 ● "Updated color palette" (Manual, 3h ago)
v4 ● "Refactored components" (AI, yesterday)
v3 ● "Added 80s theme" (AI, yesterday)
v2 ● "Initial styling" (AI, yesterday)
v1 ● "Created" (AI, yesterday)
    [Restore] [Diff with current] [View]
```

---

## 7. Artifact Search & Discovery

### Current
- Artifacts saved to `context_items` with `source_id = "artifact-{id}"`
- Searchable via hybrid search (vector + BM25)
- Only latest content indexed

### Proposed Enhancements

#### a. Per-File Indexing (for multi-file projects)
```sql
-- Index each file separately for granular search
INSERT INTO context_items (source_type, source_id, title, raw_content, ...)
VALUES
  ('sandbox', 'artifact-abc/src/App.jsx', 'App.jsx (Calculator)', '...'),
  ('sandbox', 'artifact-abc/src/index.css', 'index.css (Calculator)', '...');
```

#### b. Artifact Registry Tool
```
artifact_registry()
  → Returns complete inventory:
    - 5 code artifacts (3 JS, 1 Python, 1 HTML)
    - 3 documents (2 specs, 1 report)
    - 2 sandbox apps (calculator, dashboard)
    - Total versions: 34
    - Total cost: $0.47
```

#### c. Description Auto-Generation
When creating/editing artifacts, auto-generate:
- `description_oneliner`: "React calculator with retro themes" (~10 words)
- `description_short`: "A themed calculator app..." (~50 words)
- `description_long`: Full description (~200 words)

Use a fast model (Haiku) to generate these post-creation.

---

## 8. Context Window Integration

### Current
Context window bar shows: system prompt | rules | tools | messages

### Proposed: Add artifact segment
```
┌──────────────────────────────────────────────────┐
│ Context: 42,156 / 128,000 tokens (33%)           │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ [system 2.1k] [rules 800] [tools 3.2k]          │
│ [artifact 2.3k] [messages 33.8k]                 │
│                  ↑ NEW                            │
└──────────────────────────────────────────────────┘
```

Click "artifact" segment to see:
- Active artifact: "Retro Calculator" (sandbox, v4)
- Open file: src/App.jsx (1,800 tokens)
- Files loaded: 1 of 7

---

## 9. AI Elements Components to Install

### Priority 1 (Needed now)
| Component | Why |
|-----------|-----|
| `artifact` | Container wrapper for artifact display in chat |
| `web-preview` | Better live preview with responsive modes |
| `file-tree` | Already have custom, but AI Elements version has better UX |
| `terminal` | Show sandbox build output in real-time |

### Priority 2 (Next sprint)
| Component | Why |
|-----------|-----|
| `schema-display` | API documentation artifacts |
| `test-results` | Show test output from sandbox runs |
| `commit` | Version history display (better than current) |
| `stack-trace` | Error display from code execution |

### Priority 3 (Future)
| Component | Why |
|-----------|-----|
| `canvas` | Diagram/workflow artifacts |
| `environment-variables` | Config artifacts |
| `package-info` | Dependency management display |

---

## 10. Implementation Phases

### Phase 6: Artifact Context (Next)
- [ ] Send activeArtifactId + activeFilePath with chat requests
- [ ] Inject artifact metadata + active file content into system prompt
- [ ] Add "artifact" segment to context window tracker
- [ ] Test: "edit line 5" works without specifying which artifact

### Phase 7: Enhanced Editing
- [ ] `artifact_add_file` tool (add file to multi-file project)
- [ ] `artifact_remove_file` tool
- [ ] `artifact_rename` tool (rename file within project)
- [ ] Sandbox auto-restart on edit (don't require manual "Restart" click)
- [ ] Batch edits (edit multiple files in one tool call)

### Phase 8: Multi-Page Documents
- [ ] Store document pages as artifact_files
- [ ] Page sidebar in document editor (like file tree for code)
- [ ] `create_document` with pages array
- [ ] `edit_document` with filePath for page targeting
- [ ] Add/remove/reorder pages

### Phase 9: Version & Search Enhancements
- [ ] `artifact_diff` tool (compare versions)
- [ ] `artifact_search` tool (search across all artifacts + versions)
- [ ] `artifact_fork` tool (clone as new)
- [ ] Version timeline UI with diff view
- [ ] Per-file indexing for multi-file search

### Phase 10: New Artifact Types
- [ ] Install AI Elements: artifact, web-preview, terminal, schema-display
- [ ] Diagram artifacts (Canvas + Node/Edge)
- [ ] Spreadsheet artifacts (interactive data grid)
- [ ] Terminal artifacts (streaming build logs)
- [ ] Auto-generate descriptions on create/edit

---

## 11. Data Flow Diagram

```
                    ┌─────────────┐
                    │   User      │
                    │   Message   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Chat API   │
                    │  (route.ts) │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼────┐ ┌────▼─────┐ ┌───▼────────┐
       │ write_code│ │run_project│ │create_doc  │
       │ edit_code │ │          │ │edit_doc    │
       └──────┬────┘ └────┬─────┘ └───┬────────┘
              │            │            │
              │     ┌──────▼──────┐     │
              │     │  Sandbox    │     │
              │     │  (Vercel)   │     │
              │     │  snapshot → │     │
              │     │  preview URL│     │
              │     └──────┬──────┘     │
              │            │            │
       ┌──────▼────────────▼────────────▼──────┐
       │           createArtifact()             │
       │  → artifacts table (metadata)          │
       │  → artifact_files (multi-file content) │
       │  → artifact_versions (v1)              │
       │  → context_items (search index)        │
       └──────────────────┬────────────────────┘
                          │
                   ┌──────▼──────┐
                   │  Auto-open  │
                   │  artifact   │
                   │  panel      │
                   └─────────────┘
```

---

## 12. Open Questions

1. **Spreadsheet editing**: Build custom or use existing library (AG Grid, TanStack Table)?
2. **Real-time collab**: TipTap supports Yjs — worth wiring up for multi-user editing?
3. **Artifact sharing**: Public URLs for artifacts? (content_shares table exists)
4. **Export formats**: PDF, DOCX, ZIP for different artifact types?
5. **Artifact templates**: Pre-built starting points (e.g., "React dashboard template")?
6. **Cost budgets**: Per-artifact cost limits to prevent runaway generation?
