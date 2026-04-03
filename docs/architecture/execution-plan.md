# Granger v3 — Execution Plan

> Broken into agent-assignable tasks with acceptance criteria and test plans.
> Each task is independently executable and testable.
> Last updated: 2026-04-02

---

## Testing Strategy

### E2E Tests: Million Expect
- GitHub: https://github.com/millionco/expect
- AI-powered browser testing that generates adversarial test plans from git diffs
- Run after each task: `npx expect test`
- Generates Playwright tests automatically
- Tests UI changes in a real browser

### Unit Tests: Vitest
- Already configured (817 passing)
- Run: `pnpm test`
- New features need unit tests for core logic

### Type Safety
- `pnpm tsc --noEmit` must pass with 0 errors
- Run before every commit (pre-commit hook already does this)

### Integration Tests
- API endpoints tested via curl/fetch
- Supabase queries tested against real DB
- Tool execution tested via chat

---

## Epic 1: Artifact Auto-Open (Critical Fix)

### Task 1.1: artifact_get returns openable data
**File:** `src/lib/ai/tools.ts`
**What:** Update `artifact_get` tool to return data in the same format as `run_project` output (with filename, language, code, files, type, artifactId)
**Acceptance:**
- [ ] artifact_get returns `{ filename, language, code, type, files, artifactId, previewUrl }`
- [ ] Same shape as run_project/write_code tool output
- [ ] TS compiles with 0 errors
**Test:** Ask AI "open the competitor pricing brief" → tool returns structured data

### Task 1.2: ToolCallCard auto-opens artifact panel
**File:** `src/components/chat-interface.tsx`
**What:** Detect artifact_get output in ToolCallCard, auto-trigger `onOpenArtifact`
**Acceptance:**
- [ ] When artifact_get completes, artifact panel opens automatically
- [ ] Document artifacts open in TipTap editor
- [ ] Code artifacts open in code viewer
- [ ] Sandbox artifacts open with file tree + preview
**Test (Expect):** Send "open my latest document" → verify artifact panel appears in DOM

### Task 1.3: search_context flags artifact results
**File:** `src/lib/ai/tools.ts`
**What:** When search results have source_id starting with "artifact-", include artifact metadata
**Acceptance:**
- [ ] Search results include `isArtifact: true` flag when applicable
- [ ] Artifact results include `artifactId` for opening
**Test:** Search for a known artifact title → verify result has artifact flag

---

## Epic 2: Fix Connector Persistence

### Task 2.1: Research why MCP connections drop
**Files:** `src/lib/mcp/`, `src/app/api/mcp-servers/`
**What:** Investigate OAuth token expiry, Nango refresh, in-memory state
**Acceptance:**
- [ ] Root cause documented
- [ ] Fix approach decided
**Test:** Connect MCP → wait 2 hours → verify still connected

### Task 2.2: Persist connection state to DB
**Files:** `src/lib/mcp/`, DB migration
**What:** Store MCP connection state in DB (not just memory). Restore on server restart.
**Acceptance:**
- [ ] Connection state survives server restart
- [ ] Connection state includes last token refresh time
- [ ] Auto-reconnection on startup
**Test:** Connect MCP → restart dev server → verify connection persists

### Task 2.3: Auto-refresh OAuth tokens
**Files:** `src/lib/mcp/`, Nango integration
**What:** Add middleware that checks token expiry before each MCP call, refreshes if needed
**Acceptance:**
- [ ] Tokens refresh automatically before expiry
- [ ] No user action needed to maintain connection
- [ ] Error handling for failed refresh
**Test:** Connect MCP → wait for token to near expiry → verify auto-refresh

---

## Epic 3: Embeddings Upgrade

### Task 3.1: Research Gemini embeddings integration
**What:** Verify Gemini text-embedding-005 works through AI Gateway, test quality
**Acceptance:**
- [ ] Can generate embeddings via `@ai-sdk/gateway`
- [ ] Quality comparison with current embeddings documented
- [ ] Dimension size (768) confirmed compatible with pgvector
**Test:** Generate embedding for test text, verify 768 dimensions returned

### Task 3.2: Create embedding generation function
**File:** `src/lib/embeddings.ts` (new)
**What:** Centralized embedding function that uses Gemini, with fallback to OpenAI
**Acceptance:**
- [ ] `generateEmbedding(text)` returns number[]
- [ ] Uses Gemini text-embedding-005 by default
- [ ] Falls back to OpenAI if Gemini fails
- [ ] Handles max input length
**Test (Unit):** Call with test text, verify array of 768 numbers returned

### Task 3.3: Update ingestion pipeline to use new embeddings
**Files:** `src/lib/pipeline/process-context.ts`, cron jobs
**What:** Replace current embedding generation with new function
**Acceptance:**
- [ ] New items get Gemini embeddings
- [ ] Existing search still works (pgvector handles mixed dimensions if needed)
- [ ] Cost reduction verified in AI Gateway dashboard
**Test:** Upload a document → verify embedding generated → search finds it

### Task 3.4: Re-embed existing content (migration)
**What:** Background job to re-embed all existing context_items with Gemini
**Acceptance:**
- [ ] All items re-embedded
- [ ] Search quality maintained or improved
- [ ] Old embeddings replaced
**Test:** Search for known items → verify results still accurate

---

## Epic 4: AI Classification Pipeline

### Task 4.1: Create classification function
**File:** `src/lib/ai/classify.ts` (new)
**What:** Function that takes raw content and returns: title, short_desc, long_desc, tags, categories, entities, language, framework
**Acceptance:**
- [ ] `classifyContent(content, contentType)` returns structured metadata
- [ ] Uses Flash Lite for speed/cost
- [ ] Handles all content types (document, code, meeting, issue, message)
**Test (Unit):** Pass sample document → verify tags/description generated

### Task 4.2: Integrate classification into ingestion
**Files:** `src/lib/pipeline/process-context.ts`, `src/lib/artifacts.ts`
**What:** Auto-classify every item during ingestion (upload, sync, AI-created)
**Acceptance:**
- [ ] Upload a file → auto-classified in background
- [ ] Sync from Drive → each file classified
- [ ] AI creates artifact → classified immediately
- [ ] User notified when classification complete
**Test (Expect):** Upload a PDF → wait → verify tags appear on the item

### Task 4.3: Background processing queue
**What:** Items enter as "processing", classification runs async, moves to "ready"
**Acceptance:**
- [ ] Progress tracking: "3 of 12 files processed"
- [ ] Error handling: retry failed items
- [ ] Notification on completion
**Test:** Import 5 files → verify all eventually show "ready" status

---

## Epic 5: Library UI Overhaul

### Task 5.1: Design Finder-style column layout
**File:** `src/app/(dashboard)/context/page.tsx` (rewrite)
**What:** Three-column layout: sources → folders → files
**Acceptance:**
- [ ] Left column: source types (Drive, GitHub, uploads, AI-generated)
- [ ] Middle column: folders/categories within selected source
- [ ] Right column: files within selected folder
- [ ] Click to navigate, breadcrumb trail
**Test (Expect):** Navigate to Library → click "Google Drive" → verify folder list appears

### Task 5.2: Filtering system
**File:** `src/components/library-filters.tsx` (new)
**What:** Filter bar with: type, tags, source, date range, status
**Acceptance:**
- [ ] All filters combinable
- [ ] URL-persisted (shareable filtered views)
- [ ] Clear all button
- [ ] Filter count badges
**Test (Expect):** Apply type=code filter → verify only code items shown

### Task 5.3: Tagging system
**File:** `src/components/tag-manager.tsx` (new)
**What:** Add/remove tags on items, tag autocomplete, AI-suggested tags
**Acceptance:**
- [ ] Click tag to add
- [ ] X to remove
- [ ] Autocomplete from existing tags
- [ ] AI suggests tags based on content
**Test (Expect):** Open item detail → add tag "q2" → verify tag saved and searchable

### Task 5.4: Right-click context menu
**File:** `src/components/library-context-menu.tsx` (new)
**What:** Right-click on any item → menu with actions
**Acceptance:**
- [ ] Open in Chat
- [ ] Open in Editor/Viewer
- [ ] Share with...
- [ ] Add Tags
- [ ] Move to Folder
- [ ] Delete
- [ ] View Version History
**Test (Expect):** Right-click on document → verify menu appears → click "Open in Chat"

### Task 5.5: File detail panel
**File:** Update `src/components/context-info-panel.tsx`
**What:** Slide-over panel with full metadata, tags, version history, sharing
**Acceptance:**
- [ ] Shows all metadata fields
- [ ] Editable tags
- [ ] Version history list
- [ ] Share button
- [ ] Open in Chat button
**Test (Expect):** Click item → panel slides in → verify metadata fields present

---

## Epic 6: Connectors Page

### Task 6.1: Design consolidated connectors UI
**File:** `src/app/(dashboard)/connectors/page.tsx` (new, replaces integrations + MCP pages)
**What:** Single page showing all MCP + API connections
**Acceptance:**
- [ ] Card per connector with: name, icon, status, last sync, permissions
- [ ] Modern design matching chat UI
- [ ] NeuralDots animation on connecting state
- [ ] Connect/disconnect buttons
**Test (Expect):** Navigate to /connectors → verify all connections listed

### Task 6.2: Read/Write permission toggles
**What:** Per-connector toggles for read and write access
**Acceptance:**
- [ ] Toggle switches on each connector card
- [ ] Persisted to DB
- [ ] Enforced in tool permissions
**Test:** Set connector to read-only → verify write tools are disabled

### Task 6.3: Share connector access
**What:** Share button on connectors to give team members access
**Acceptance:**
- [ ] Share dialog with team member picker
- [ ] Shared connectors visible in other user's connector list
- [ ] Shared data searchable by recipient
**Test:** Share Drive connector with another user → verify they can search Drive files

---

## Epic 7: Google Drive Selective Import

### Task 7.1: File picker component
**File:** `src/components/drive-picker.tsx` (new)
**What:** Browse Drive folders, select files, initiate import
**Acceptance:**
- [ ] Browse folder structure
- [ ] Select individual files or entire folders
- [ ] Show file size and type
- [ ] "Import Selected" button
**Test (Expect):** Open Drive picker → navigate to folder → select file → click import

### Task 7.2: Background import with progress
**File:** `src/app/api/integrations/import/route.ts` (new)
**What:** API endpoint that imports selected files in background
**Acceptance:**
- [ ] Returns immediately with job ID
- [ ] Progress queryable: "3 of 12 files"
- [ ] Each file processed through classification pipeline
- [ ] Notification on completion
**Test:** Import 3 files → poll progress → verify all complete

---

## Epic 8: Sharing System

### Task 8.1: Database migration for sharing
**What:** Create `content_shares` table
**Acceptance:**
- [ ] Table exists with: content_id, content_type, shared_by, shared_with, permission
- [ ] RLS policies for share visibility
- [ ] Indexes for query performance
**Test (SQL):** Insert share record → verify accessible by recipient

### Task 8.2: Share dialog component
**File:** `src/components/share-dialog.tsx` (new)
**What:** Modal for sharing items with team members
**Acceptance:**
- [ ] Search for team members
- [ ] Set permission level (viewer/editor/owner)
- [ ] Shows current shares
- [ ] Remove share button
**Test (Expect):** Right-click item → Share → select member → verify share created

### Task 8.3: "Shared with me" section in library
**What:** Library section showing items shared by others
**Acceptance:**
- [ ] Separate section or filter in library
- [ ] Shows who shared and when
- [ ] Shared items searchable via vector search
**Test (Expect):** Log in as second user → verify shared items appear

---

## Epic 9: Tool Result Cards

### Task 9.1: Create ToolResultCard component
**File:** `src/components/tool-result-card.tsx` (new)
**What:** Universal card for all tool outputs with NeuralDots header
**Acceptance:**
- [ ] Header: NeuralDots icon + tool label + source
- [ ] Body: rendered content (varies by tool)
- [ ] Footer: citation links with favicons
- [ ] States: running (animated), complete (check), error (x)
**Test (Expect):** Trigger web search → verify card renders with citations

### Task 9.2: Citation bar with hover preview
**File:** `src/components/citation-bar.tsx` (new)
**What:** Row of source links with favicons, hover shows preview
**Acceptance:**
- [ ] Favicon via Google's service
- [ ] Hover popup: title, description, "Ask Granger to read this"
- [ ] Links open in new tab
**Test (Expect):** Hover over citation → verify popup appears

### Task 9.3: Link preview API
**File:** `src/app/api/link-preview/route.ts` (new)
**What:** Fetch og:title, og:description, og:image from URL
**Acceptance:**
- [ ] Returns title, description, image URL
- [ ] Caches results (don't refetch same URL)
- [ ] Timeout handling
**Test (Unit):** Call with known URL → verify metadata returned

---

## Epic 10: Context Engineering

### Task 10.1: Implement context caching
**What:** Use Vercel AI SDK caching for repeated context (priority docs, system prompt)
**Acceptance:**
- [ ] Priority docs cached across calls
- [ ] Token savings measured
- [ ] Cache invalidated when docs change
**Test:** Send 5 messages → verify cached context in AI Gateway logs

### Task 10.2: Verify compaction works end-to-end
**What:** Test that conversation compaction triggers and preserves quality
**Acceptance:**
- [ ] Send 20+ messages in one conversation
- [ ] Compaction triggers at 80% context
- [ ] Conversation quality maintained after compaction
- [ ] Full history still in DB (can branch)
**Test:** Long conversation → verify compaction message in logs → verify AI still has context

---

## Test Commands

```bash
# TypeScript
PATH="/opt/homebrew/bin:$PATH" /opt/homebrew/bin/node node_modules/typescript/bin/tsc --noEmit

# Unit tests
pnpm test

# E2E with Million Expect (after install)
npx expect test

# Lint
pnpm lint

# Build
pnpm build

# Dev server
pnpm dev --port 3204
```

---

## Agent Assignment Guide

Each epic can be assigned to a Claude Code agent in a worktree:
```bash
# Example: assign Epic 1 to an agent
claude "Implement Epic 1 from docs/architecture/execution-plan.md. Read the file first, then implement all 3 tasks. Run tsc after each change."
```

Epics 1-3 can run in parallel (no dependencies).
Epic 4 depends on Epic 3 (needs new embeddings).
Epic 5 can start independently.
Epics 6-9 can run in parallel after Epic 5.
Epic 10 is independent.
