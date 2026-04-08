# Portal — Remaining Issues & Next Session Plan

> Updated: April 8, 2026 (end of session 5)
> 45+ commits this session across main platform + portal

## What's Working

- PDF viewer with continuous scrolling, zoom, page nav, two-page spread
- Document switching (Proposal ↔ Scope) with tabs in header
- AI reads both documents from system prompt (no more 20+ tool call loops)
- render_chart tool called correctly (1 call per visualization request)
- Bubble menu: Send to Chat, Explain, Visualize, Research
- Context tags with hover preview
- Presentation mode with arrow key navigation
- Table of contents sidebar (extracted from document headings)
- Download PDF button
- Tool toggles dropdown menu
- Floating prompt bar in compact mode
- 65/35 split in expanded mode
- Distraction-free mode
- Mobile responsive (TOC overlay, hidden controls)
- ToolLoopAgent (same pipeline as main chat)

## Critical Fixes (Next Session)

### 1. Chart HTML not rendering inline
**Problem**: `render_chart` returns `{html, width, height}` but the tool card just shows "render_chart ✓" without rendering the chart. The main chat renders inline HTML via iframe detection in the tool output — this same logic needs to work in portal mode.

**Fix**: In ChatInterface's tool card rendering, detect when a tool output contains `{html}` and render it as an iframe/sandbox. Check how the main chat handles inline HTML tool outputs (likely in `ToolCallCard` or `SafeToolCallCard`).

### 2. PDF annotations from AI responses
**Problem**: When AI calls `highlight_text` or `navigate_pdf`, the tool returns data (`{action: "highlight", text, page}` or `{action: "navigate", page}`) but the PDF viewer doesn't react. The tools work server-side but there's no client-side bridge.

**Fix**: Watch for tool outputs in the chat messages. When a `highlight_text` or `navigate_pdf` tool completes:
- Extract the response data
- Update the `highlightText` and `currentPage` state in portal-viewer
- The PDF viewer already accepts these as props

### 3. Animated annotations / callouts
**Problem**: User wants the AI to add visual notes, callouts, and animated highlights on the PDF — like a teacher pointing at sections with tooltip explanations.

**Fix approach**:
- Create an `AnnotationOverlay` component that renders on top of the PDF
- Annotations are positioned based on page number + text match position
- Each annotation: small indicator dot → hover/click → tooltip with AI explanation
- Animate in with CSS transitions (scale up, fade in)
- AI generates annotations via a new `add_annotation` tool that returns `{page, text, note, type}`
- Annotations persist in state and can be dismissed

### 4. Chat state resets on compact/expanded toggle
**Problem**: Despite single ChatInterface instance with CSS positioning, the chat still loses state when switching modes. The `key` prop includes `chatKey` which is stable, but the component may still remount due to React reconciliation with the conditional wrapper structure.

**Fix**: Ensure the ChatInterface's parent DOM element is always the same. Currently the wrapper div changes classes but should stay in the same position in the React tree. May need to verify with React DevTools that the component isn't remounting.

### 5. TOC doesn't update when switching documents
**Problem**: TOC is built from `portal.document_content` which is loaded once. When switching to the Scope doc, the TOC still shows Proposal headings.

**Fix**: The API now loads content for all documents. The portal-viewer needs to track the active document's content separately and rebuild TOC when switching. Use the `documents[].content` field from the API response.

## Phase 4 Features (Future)

### Interactive PDF elements
- Detect diagrams/charts in the PDF by region
- Overlay interactive HTML/SVG on top of PDF canvas
- AI recreates static diagrams as animated visualizations
- "Explain this diagram" steps through each element with annotations

### Session replay & analytics
- Record all portal interactions as JSON events (page turns, chats, highlights)
- Playback viewer with scrubber and speed controls
- Heatmap overlay showing most-viewed sections
- Engagement metrics (time per page, questions asked)

### Audio narration
- Pre-generated MP3 for each document
- Play/pause with page sync
- Future: TTS generation via AI Gateway
