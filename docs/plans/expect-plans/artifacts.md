# Expect Plan — Artifacts

> The core of principle #4: **AI can do everything a human can do with their finger**.

## Matrix
Desktop + Mobile × Light + Dark

## Code Artifacts

### S1 — write_code
1. Chat: "Write a React button that shows a confetti burst on click."
2. **Expect**: `write_code` tool fires.
3. **Expect**: artifact panel opens on right (desktop) or bottom sheet (mobile).
4. **Expect**: syntax-highlighted code, copy button works.

### S2 — run_code (single file)
1. Chat: "Run a Node script that prints 1..10."
2. **Expect**: `run_code` fires, sandbox executes.
3. **Expect**: output terminal shows 1-10.

### S3 — run_project (multi-file)
1. Chat: "Build a Next.js page with a todo list."
2. **Expect**: `run_project` creates filesystem, installs deps, serves.
3. **Expect**: file tree on left, Code/Preview/Live tabs.
4. Switch to Live.
5. **Expect**: iframe loads the running app.

### S4 — edit_code
1. In an existing artifact, chat: "Change the button color to teal."
2. **Expect**: `edit_code` tool fires with `editDescription: "Change button color to teal"`.
3. **Expect**: diff preview → apply.
4. **Expect**: `artifact_interactions` row logged.

### S5 — Persistent snapshot (TARGET)
1. Run a project.
2. Stop sandbox.
3. Re-run same project.
4. **Expect**: "Restoring snapshot…" (not "npm install…").
5. **Expect**: startup time < 3s.

### S6 — Cost tracking (TARGET)
1. Run a project.
2. Stop.
3. Check `/analytics/costs`.
4. **Expect**: row with CPU-ms, network bytes, computed USD cost.

## Document Artifacts (TipTap) — TARGET feature

### S7 — create_document
1. Chat: "Create a document titled 'Launch Plan'."
2. **Expect**: `create_document` tool fires.
3. **Expect**: TipTap editor opens in artifact panel with empty doc.

### S8 — Auto-save + versions
1. Type content.
2. Pause 3s.
3. **Expect**: "Saved" indicator + new version row.

### S9 — Bubble menu AI edit
1. Highlight a paragraph.
2. **Expect**: bubble menu with Bold / Italic / ✨ AI Edit.
3. Click AI Edit.
4. Type "make this more concise".
5. **Expect**: only highlighted range replaced (not whole doc).

### S10 — Manual formatting
1. Highlight word.
2. Click Bold in bubble menu.
3. **Expect**: word bolded.
4. Same for italic, heading.

### S11 — Version restore
1. Open version history.
2. Click v1.
3. **Expect**: editor content reverts.

## AI-Controllable UI Primitives — CORE PRINCIPLE #4

### S12 — AI opens artifact panel
1. Chat: "Open the artifact panel."
2. **Expect**: `artifact_panel` tool fires, panel opens.

### S13 — AI closes panel (TARGET)
1. Chat: "Close the panel."
2. **Expect**: `artifact_panel_close` tool fires, panel closes.

### S14 — AI switches tab (TARGET)
1. Chat: "Show me the live preview."
2. **Expect**: `artifact_view_switch` tool fires, Live tab active.

### S15 — AI highlights text in TipTap (TARGET)
1. Chat: "Highlight the second paragraph."
2. **Expect**: `doc_highlight_range` tool fires.
3. **Expect**: range visually selected.

### S16 — AI formats range (TARGET)
1. Chat: "Bold all dates in the document."
2. **Expect**: `doc_format_selection` tool fires with bold on each date range.

### S17 — AI inserts heading (TARGET)
1. Chat: "Add a heading 'Conclusion' at the end."
2. **Expect**: `doc_insert_heading` tool fires.

### S18 — AI undo/redo (TARGET)
1. Chat: "Undo that last change."
2. **Expect**: `doc_undo` fires.

## Mobile

### S19 — Mobile artifact
1. Artifact panel slides up from bottom as sheet.
2. File tree collapses into dropdown.
3. Editor is full-width.

### S20 — Mobile bubble menu
1. Long-press text.
2. **Expect**: selection handles + bubble menu with AI Edit.
3. AI Edit input appears above keyboard.

## Dark Mode

### S21 — Dark artifact
1. Toggle dark.
2. Syntax highlighting uses dark theme (no white flash).
3. TipTap editor: text readable, selection color visible.
