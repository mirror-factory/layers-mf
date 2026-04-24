# Expect Plan — Library

> Run: `EXPECT_BASE_URL=http://localhost:3000 npx expect-cli --agent claude -m "$(cat docs/plans/expect-plans/library.md)" -y`

## Matrix
Desktop + Mobile × Light + Dark

## Current-state tests

### S1 — Browse + filter
1. `/context` → library.
2. Click source filter "Google Drive".
3. **Expect**: only drive items visible.
4. Add content type filter "PDF".
5. **Expect**: filtered further.

### S2 — Hybrid search
1. Search "invoice Q1".
2. **Expect**: results from multiple sources ranked by relevance (vector + BM25 RRF).
3. Click top result.
4. **Expect**: detail page with summary, entities, source link.

### S3 — Upload
1. Drag a PDF onto library.
2. **Expect**: upload progress.
3. **Expect**: status "Processing" → "Ready" within pipeline time.
4. **Expect**: AI-generated title, summary, entities populate.

### S4 — Versions
1. Open a document, view version history.
2. Click "Restore v2".
3. **Expect**: current content reverts to v2, new version row added.

### S5 — Tag + share
1. Right-click item → Tag.
2. Add "Q1-report".
3. Share with user by email, permission = edit.
4. **Expect**: recipient sees in "Shared with Me", can edit.

### S6 — Library sections
1. Check tabs: My Items / Shared with Me / Org Library.
2. **Expect**: my uploads in "My Items".
3. **Expect**: shared items in "Shared with Me".
4. **Expect**: org items (auto-ingested from Drive) in "Org Library".

### S7 — Auto-embedded artifacts
1. In `/chat`, use `write_code` to create an artifact.
2. Go to `/context`.
3. **Expect**: artifact listed as a library item with type=artifact.

### S8 — Auto-embedded conversations
1. Have a 20+ message conversation.
2. **Expect**: after completion, conversation summary appears in library.

## AI-controllable

### S9 — AI search
1. In chat: "Find the Q1 sales report".
2. **Expect**: `search_context` tool fires, returns result.

### S10 — AI get document
1. In chat: "Open the document with ID <id>".
2. **Expect**: `get_document` fires, content rendered as artifact or reference.

### S11 — AI navigate (TARGET)
1. In chat: "Navigate to the Photos section".
2. **Expect**: `library_navigate` tool routes user to `/context?section=photos`.
   *(Tool missing — logged in AI Tool Coverage Matrix)*

### S12 — AI rename (TARGET)
1. In chat: "Rename this document to 'Final Contract'".
2. **Expect**: `library_rename` fires.
   *(Tool missing)*

## Known issues to prove
- Library structure is user-confused (see Sprint D research).
- MCP sources muddled with file sources.
- Photos have no photo-specific UI.

## Mobile

### S13 — Mobile list
1. `/context` on 393×852.
2. **Expect**: grid collapses to list, each row has source icon + title + date.
3. Tap item → detail slides up.

### S14 — Mobile upload via camera
1. Tap upload.
2. **Expect**: option to take photo or choose from library.
3. Take photo.
4. **Expect**: uploads as photo type.
