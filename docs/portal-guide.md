# Portal Guide — Theming, Tools & Developer Reference

**Version:** 0.7.1
**Last updated:** April 12, 2026

---

## 1. Quick Start

### Creating a Portal

Portals are stored in the `document_portals` Supabase table. Each portal has:
- A unique `share_token` (the URL slug)
- Document content (either inline or linked via `context_item_id`)
- Branding configuration
- Optional tool and model overrides

**Demo URL:** `/portal/bluewave-demo`

### How Data Flows

```
Browser → /portal/[token]/page.tsx
  ↓ fetch /api/portals/public/{token}
  ↓ PortalData interface
  ↓ <PortalSplash> (loading screen)
  ↓ <PortalViewer portal={data}>
    ├── <PortalPdfViewer> (document rendering)
    ├── <ChatInterface variant={PORTAL_VARIANT}> (AI chat)
    ├── <PortalVoiceMode> (STT/TTS)
    └── <PortalAnnotationOverlay> (sticky notes)
```

---

## 2. Theming & Branding

### Brand Color

The primary brand color flows from `portal.brand_color` (default: `#0DE4F2` cyan).

**Where it's used:**
- Active tab indicators
- Quick action chips
- Voice mode mic button
- Highlight overlay accent
- Loading spinner on splash screen
- Chat suggestion pills

**To change:** Set `brand_color` in the `document_portals` DB row.

### PortalData Interface

```typescript
interface PortalData {
  id: string;
  title: string;
  subtitle: string | null;
  client_name: string | null;
  brand_color: string;              // PRIMARY — flows everywhere
  brand_secondary_color: string | null;
  logo_url: string | null;          // Splash + header logo
  pdf_url: string | null;           // Main document PDF
  document_content: string | null;  // Full text (for AI context)
  documents: PortalDocument[];      // Multi-doc support
  audio_url: string | null;         // Optional audio walkthrough
  system_prompt: string | null;     // Custom AI personality
  enabled_tools: string[];          // Extra tools beyond core 20
  model: string;                    // AI model override
  hide_chrome: boolean;             // Minimal UI mode
  default_expanded: boolean;        // Start with sidebar chat open
  share_token: string;              // URL slug
  page_count: number | null;
}
```

### Dark / Light Mode

**Default:** Dark mode (`#1a1f2e` background)
**Toggle:** Sun/Moon button in portal header
**Persistence:** `localStorage("portal-theme")` — survives refreshes
**Implementation:** Toggles `.dark` class on `document.documentElement`

**Key dark mode colors:**
| Element | Dark | Light |
|---------|------|-------|
| Background | `#1a1f2e` | `bg-slate-50` |
| Content area | `#141821` | `bg-slate-100` |
| Panel BG | `#1e2433` | `bg-slate-50` |
| Text | `text-slate-100` | `text-slate-900` |
| Borders | `border-white/5` | `border-slate-200` |
| Muted text | `text-white/40` | `text-slate-500` |

### ChatVariant System

The chat component accepts a `variant` prop for full visual customization:

```typescript
interface ChatVariant {
  style: "default" | "portal";
  gradientFrom: string;        // Tailwind gradient start
  gradientTo: string;          // Tailwind gradient end
  headingColor: string;        // Tailwind text class
  bodyColor: string;
  mutedColor: string;
  inputBorder: string;         // Tailwind border class
  inputBg: string;             // Tailwind bg class
  suggestions: { text: string; accent: boolean }[];
  voiceEnabled: boolean;
  tools: string[];
}
```

**Built-in variants:**
- `PORTAL_VARIANT` — Dark-first, cyan accents, voice enabled, 3 suggestion pills
- `DEFAULT_VARIANT` — Standard app theme, no voice, no suggestions

**Creating a custom variant:**
```typescript
import { ChatVariant } from "@/components/chat-interface";

const MY_VARIANT: ChatVariant = {
  style: "portal",
  gradientFrom: "from-transparent",
  gradientTo: "to-slate-50 dark:to-[#1a1f2e]",
  headingColor: "text-emerald-700 dark:text-emerald-300",
  bodyColor: "text-slate-600 dark:text-white/70",
  mutedColor: "text-slate-500 dark:text-white/40",
  inputBorder: "border-emerald-300 dark:border-emerald-800",
  inputBg: "bg-white dark:bg-white/5",
  suggestions: [
    { text: "Summarize this contract", accent: true },
    { text: "What are the key risks?", accent: false },
  ],
  voiceEnabled: true,
  tools: [],
};
```

### Splash Screen Branding

The `PortalSplash` component handles the loading experience:

```typescript
interface PortalSplashConfig {
  loaded: boolean;
  logoUrl?: string;           // Falls back to /bluewave-logo.svg
  clientName?: string;        // Shown below logo
  subtitle?: string;          // Contextual description
  brandColor?: string;        // Accent color (default #0DE4F2)
  backgroundColor?: string;   // Splash BG (default #f4fbff)
  minDuration?: number;       // Min display time ms (default 2200)
  fadeDuration?: number;      // Fade-out ms (default 800)
}
```

### Hardcoded Colors to Watch

These colors are currently hardcoded and may need extraction for full white-labeling:

| Color | Where | Purpose |
|-------|-------|---------|
| `#0DE4F2` | Default brand color | Primary accent everywhere |
| `#1a1f2e` | Portal layout, viewer | Dark mode background |
| `#141821` | Content area | Darker panel background |
| `#f4fbff` | Splash screen | Light splash background |
| `rgba(253,224,71,0.55)` | PDF viewer CSS | Highlight overlay yellow |
| `#f59e0b` | Voice mode | Speaking state indicator |
| `#22c55e` | Voice mode | Listening state indicator |

---

## 3. AI Tools Reference (20 Core Tools)

All tools are defined in `/api/chat/portal/route.ts` and executed server-side.

### Navigation Tools

#### `switch_document`
Switch between portal documents by title.
```
Input:  { title: string }
Output: { action: "switch_document", title, context_item_id, content_preview, page_count }
```

#### `navigate_pdf`
Go to a specific page number.
```
Input:  { page: number, highlight?: string, reason?: string }
Output: { action: "navigate", page, total_pages, highlight, reason }
```

#### `open_document_preview`
Open a library document as a new tab.
```
Input:  { document_id: string, reason?: string }
Output: { action: "open_document_preview", document_id, reason }
```

#### `navigate_portal`
Navigate to named sections/tabs.
```
Input:  { target: string, reason?: string }
Output: { action: "navigate", target, reason }
```

### Content Interaction Tools

#### `highlight_text`
Highlight a phrase with yellow overlay + auto-scroll.
```
Input:  { text: string }  // 4-8 word distinctive phrase
Output: { action: "highlight", text }
```

#### `add_annotation`
Add a visual callout on a PDF page.
```
Input:  { page: number, text: string, note: string, type?: "info"|"highlight"|"warning"|"tip" }
Output: { action: "add_annotation", page, text, note, type }
```

#### `search_document`
Keyword search returning line-number matches.
```
Input:  { query: string, max_results?: number }
Output: { query, total_matches, results: [{ lineNumber, text, page }] }
```

#### `get_page_content`
Read a specific page's text content.
```
Input:  { page: number }
Output: { page, total_pages, content }
```

#### `summarize_section`
Get content for a page range (AI summarizes in response).
```
Input:  { start_page: number, end_page: number }
Output: { start_page, end_page, total_pages, content, note }
```

#### `capture_screen`
Flash animation on a document region.
```
Input:  { region: "full"|"top-left"|"top-right"|...|"center", page?: number, description_request?: string }
Output: { action: "capture_screen", region, page, description_request, note }
```

### Visualization Tools

#### `render_chart`
Render a Chart.js chart inline in chat.
```
Input:  { chart_config: string (JSON), title?: string }
Output: { html: string }  // Full HTML document with Chart.js
```

#### `walkthrough_document`
Animated section-by-section tour.
```
Input:  { sections: [{ page, title, note }] }
Output: { action: "walkthrough", sections, total }
```

### Library Tools

#### `get_document_registry`
List all available documents (library + portal).
```
Input:  {}
Output: { total, documents: [{ id, title, type, category, description, source }] }
```

#### `lookup_document`
Read document content by ID.
```
Input:  { document_id: string, query?: string, max_chars?: number }
Output: { document_id, content, total_chars?, truncated?, source }
```

#### `compare_documents`
Side-by-side comparison of two documents.
```
Input:  { doc_a_id: string, doc_b_id: string, focus?: "pricing"|"scope"|"timeline"|"terms"|"all" }
Output: { action: "compare_documents", doc_a_id, doc_b_id, doc_a_preview, doc_b_preview, focus, note }
```

#### `list_documents`
List portal documents with active status.
```
Input:  {}
Output: { documents: [{ title, is_active }], active }
```

### User Action Tools

#### `save_bookmark`
Save a persistent bookmark with annotation.
```
Input:  { page: number, title: string, note: string, section_text?: string }
Output: { action: "save_bookmark", page, title, note, section_text? }
```

#### `share_feedback`
Compile viewer feedback for the sender.
```
Input:  { summary: string, questions?: string[], concerns?: string[], approvals?: string[] }
Output: { action: "share_feedback", summary, questions, concerns, approvals, note }
```

#### `generate_brief`
Generate an executive summary.
```
Input:  { focus?: "full"|"budget"|"timeline"|"risks"|"deliverables" }
Output: { action: "generate_brief", focus, note }
```

#### `track_reading`
Reading progress and unread sections.
```
Input:  { current_page?: number }
Output: { action: "track_reading", current_page, total_pages, note }
```

#### `web_search`
Search the web via Perplexity.
```
Input:  { query: string }
Output: { query, result, source, citations } | { error, query }
```

### Intent Detection

The server narrows available tools based on user message keywords:

| User says... | Tools activated |
|---|---|
| "chart", "graph", "visualize", "plot" | `render_chart` |
| "walkthrough", "walk me through", "tour" | `walkthrough_document` |
| "highlight", "budget", "pricing", "timeline", "scope" | `highlight_text`, `switch_document` |
| "bookmark", "save a note", "remember this" | `save_bookmark` |
| "go to", "open", "switch to", "navigate to" | `switch_document`, `navigate_pdf`, `open_document_preview` |

If no intent matches, all 20 tools are available.

---

## 4. Adding a New Portal

### Database Row

Insert into `document_portals`:

```sql
INSERT INTO document_portals (
  share_token, is_public, title, client_name, client_context,
  brand_color, logo_url, document_content, documents, model
) VALUES (
  'acme-proposal',
  true,
  'Proposal — Acme Corp',
  'Acme Corporation',
  'Fortune 500 manufacturing company exploring digital transformation.',
  '#FF6B35',
  '/logos/acme.svg',
  'Full document text here...',
  '[{"title": "Main Proposal", "is_active": true, "context_item_id": "ctx-123"}]',
  'google/gemini-3.0-flash'
);
```

### Converting Documents to PDF

All DOCX/XLSX files should be converted to PDF for unified rendering:

```bash
# Requires LibreOffice installed
npx ts-node scripts/convert-docs-to-pdf.ts
```

Place PDFs in `public/portal-docs/{portal-name}/` and reference via `pdf_path` in the document array.

### Custom AI Personality

Set `system_prompt` on the portal row to override the default Mirror Factory personality:

```sql
UPDATE document_portals SET system_prompt = '
You are a helpful assistant for Acme Corp proposals.
Be formal and precise. Reference specific contract clauses.
' WHERE share_token = 'acme-proposal';
```

### Adding Custom Tools

1. Add tool name to `enabled_tools` array in the portal row
2. Define the tool in `createPortalTools()` in `route.ts`
3. Add intent detection regex if needed

---

## 5. Architecture Decisions

### Why Everything is PDF
Three separate renderers (PDF.js, docx-preview, jspreadsheet) had different DOM structures. Highlight/scroll/annotate worked differently on each. Converting everything to PDF via LibreOffice unified the experience — one renderer, one interaction model.

### Why Intent Detection
Gemini 3.0 Flash (and especially Flash Lite before it) struggles with 20+ tools. It loops through search/lookup tools before getting to the action. Intent detection narrows to 1-3 tools per request, forcing correct selection. With stronger models, this becomes less necessary but still improves latency.

### Why ChatVariant, Not Separate Components
The chat is used in portal mode, the main app, and potentially embedded contexts. A typed variant config allows visual customization without forking the 3000-line ChatInterface component.

### Why Cartesia Over ElevenLabs
Cartesia sonic-turbo: 40ms first-byte latency. ElevenLabs Flash v2.5: 75ms. Both are in the Vercel ecosystem, but Cartesia required a custom `/api/tts` route (no native AI SDK support yet).

---

## 6. Testing

### Running Portal Tests

```bash
# Portal API route tests (50 tests)
pnpm vitest run src/app/api/chat/portal/route.test.ts

# All tests
pnpm test
```

### Test Coverage Areas

| Area | Tests | Status |
|------|-------|--------|
| Portal API route validation | 6 tests | Covered |
| Model selection | 2 tests | Covered |
| Voice mode header | 1 test | Covered |
| Intent detection (5 categories) | 26 tests | Covered |
| Tool helper: splitPages | 3 tests | Covered |
| Tool helper: searchDocumentContent | 5 tests | Covered |
| Portal components (PortalViewer, etc.) | 0 tests | Gap |
| E2E portal flow | Playwright specs | In e2e/portal.spec.ts |

### Known Test Gaps

- Portal components have zero unit tests (14 files, 8,437 lines)
- Portal tool execute functions need individual tests
- Voice mode STT/TTS needs browser testing
- No visual regression tests

---

## 7. Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `AI_GATEWAY_API_KEY` | Yes | All AI model access |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server admin access |
| `CARTESIA_API_KEY` | For voice | TTS via sonic-turbo |

### Local Development

```bash
pnpm install
brew install --cask libreoffice  # For doc conversion
pnpm dev
# Visit http://localhost:3000/portal/bluewave-demo
```
