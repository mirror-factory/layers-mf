# Layers Portal

An AI-powered interactive document portal for sharing proposals, presentations, and multi-document packages with clients. Built on Next.js 16, Vercel AI SDK, and Supabase.

Live portals are publicly accessible via share token — no login required for viewers.

---

## Architecture

```
src/app/portal/[token]/          → Public portal viewer (no auth)
src/app/api/portals/             → Portal CRUD + upload + analytics
src/app/api/chat/portal/         → AI chat endpoint (Vercel AI SDK)
src/app/api/tts/                 → Text-to-speech (Cartesia)
src/app/(auth)/                  → Login / signup / password reset
src/app/page.tsx                 → Landing page
```

### Key Components

| Component | File | Description |
|-----------|------|-------------|
| PortalViewer | `src/components/portal-viewer.tsx` | Main orchestrator (~2000 lines). Manages PDF display, chat, annotations, voice, document library, dark/light theme |
| PortalPdfViewer | `src/components/portal-pdf-viewer.tsx` | PDF renderer using `react-pdf`. Continuous scroll, text selection actions, Cmd+F search, AI highlights, spread mode |
| PortalSplash | `src/components/portal-splash.tsx` | Animated loading screen with brand colors and logo |
| PortalVoiceMode | `src/components/portal-voice-mode.tsx` | Voice input (Web Speech API) + TTS output (Cartesia) |
| PortalRichContent | `src/components/portal-rich-content.tsx` | Text-only document renderer with auto-generated charts for budget/table sections |
| PortalAnalyticsDashboard | `src/components/portal-analytics-dashboard.tsx` | Viewer engagement stats: sessions, duration, pages viewed, messages sent |
| PortalAnnotationOverlay | `src/components/portal-annotation-overlay.tsx` | AI-added callouts on PDF pages (info, highlight, warning, tip) |
| PortalOnboarding | `src/components/portal-onboarding.tsx` | 3-step walkthrough tour on first visit |
| PortalWelcomeModal | `src/components/portal-welcome-modal.tsx` | First-visit feature highlights modal |

---

## Vercel AI SDK Setup

### Chat Route (`src/app/api/chat/portal/route.ts`)

The portal chat uses the **Vercel AI SDK** agentic loop pattern:

```
ToolLoopAgent → createAgentUIStreamResponse → streamed to client
```

**SDK functions used:**
- `ToolLoopAgent` from `ai` — runs an agentic tool loop, capped at `stopWhen: stepCountIs(4)` (max 4 tool iterations per request)
- `createAgentUIStreamResponse` — streams the response as a UI message stream to the client
- `convertToModelMessages` — converts `UIMessage[]` from the client into model-compatible messages
- `wrapLanguageModel` — wraps the model with compaction middleware for automatic context compression
- `tool` from `ai` — defines each portal tool with Zod schemas
- `generateText` — used internally by the `web_search` tool to call Perplexity

### Model Configuration

- **Default model**: `google/gemini-3.0-flash` (configurable per portal via `portal.model` field)
- Routed through the AI gateway at `@/lib/ai/config`
- Wrapped with `createCompactionMiddleware` using `getContextWindow(modelId)` for automatic context compression when conversations get long

### Context Injection

The system prompt is built dynamically per request:

1. **Document content** — the full text of the active PDF/document is injected inline into the system prompt
2. **All portal documents** — content from every document in the portal is included so the AI can reference any of them without tool calls
3. **User highlights** — text the viewer selects/highlights is sent via `x-portal-context` header (Base64-encoded JSON), decoded and added to context
4. **Client context** — the `portal.client_context` field provides client-specific personality/knowledge
5. **Voice mode** — when `x-voice-mode: true` header is sent, a suffix is appended requiring short 1-3 sentence responses with no markdown
6. **Custom system prompt** — `portal.system_prompt` can override the default entirely (navigation rules are always appended)
7. **Date/time** — current date/time in Eastern Time is always included

### Intent Narrowing

Before each request, the last user message is pattern-matched to narrow the active tool set:
- Chart keywords → only `render_chart`
- Walkthrough keywords → only `walkthrough_document`
- Highlight/budget/pricing keywords → `highlight_text` + `switch_document`
- Navigate/open keywords → `switch_document` + `navigate_pdf` + `open_document_preview`

This reduces hallucinated tool calls and speeds up responses.

---

## AI Tools

The portal defines 20 tools. Each is gated by the portal's `enabled_tools` array, though core tools (`search_document`, `navigate_pdf`, `get_page_content`) are always force-enabled.

### Document Tools

| Tool | Status | Description |
|------|--------|-------------|
| `search_document` | Working | Keyword search across document content. Returns line numbers, text, and estimated page numbers. Splits content into ~3000-char pages |
| `get_page_content` | Working | Returns the text content of a specific page (~3000-char chunk) |
| `summarize_section` | Working | Returns raw text for a page range and instructs the AI to summarize it |
| `lookup_document` | Working | Retrieves content from portal docs, context_items table, or local filesystem manifest. Supports optional query filtering |
| `compare_documents` | Working | Returns first 2000 chars of two documents for AI comparison |
| `list_documents` | Working | Lists all documents in the portal with active status. Only available when portal has >1 document |
| `switch_document` | Working | Switches to a different document in the portal. Loads content from `context_items` table |
| `get_document_registry` | Working | Returns the full document registry (portal docs + library docs) |

### Navigation Tools

| Tool | Status | Description |
|------|--------|-------------|
| `navigate_pdf` | Working | Navigates to a specific page with optional text highlight. Client calls `pdfControls.goToPage()` |
| `navigate_portal` | Working | Routes to library, portal doc, or library doc views |
| `highlight_text` | Working (bug) | Highlights text on the current page. **Bug: defined twice in code — second definition overwrites first, losing the `reason` parameter** |
| `walkthrough_document` | Working | Creates a guided walkthrough with sections `[{page, title, note}]`. Client auto-navigates to first section |

### Visualization Tools

| Tool | Status | Description |
|------|--------|-------------|
| `render_chart` | Working | Generates Chart.js charts as self-contained iframe HTML. Supports bar, line, pie, doughnut, radar, etc. Uses brand cyan as primary color |

### Annotation Tools

| Tool | Status | Description |
|------|--------|-------------|
| `add_annotation` | Working | Adds a callout to a specific page (info/highlight/warning/tip types). Rendered by AnnotationOverlay |
| `save_bookmark` | Working | Saves a bookmark as a "tip" annotation on a specific page |

### External Tools

| Tool | Status | Description |
|------|--------|-------------|
| `web_search` | Working | Calls Perplexity API via `generateText` for real-time web search. Extracts citations from metadata or URL regex |

### Engagement Tools

| Tool | Status | Description |
|------|--------|-------------|
| `track_reading` | Stub | Returns a note telling AI to use conversation history. No actual tracking logic |
| `capture_screen` | Cosmetic only | Triggers a CSS flash animation but does NOT actually capture or analyze screen pixels |
| `share_feedback` | Stub | Returns structured feedback object with a note saying "would be emailed in production." No email integration |
| `generate_brief` | Partial | Instructs the AI to format a brief from context. No actual computation — relies on AI to do the work |
| `open_document_preview` | Working | Opens a document in the library viewer by ID |

---

## Portal API Routes

### Authenticated Routes (require Supabase session)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portals` | GET | List all portals for user's org |
| `/api/portals` | POST | Create a new portal. Required: `title`. Optional: `subtitle`, `client_name`, `pdf_storage_path`, `document_content`, `brand_color`, `model`, `enabled_tools`, etc. |
| `/api/portals/[id]` | GET | Get a single portal by ID |
| `/api/portals/[id]` | PATCH | Update portal fields |
| `/api/portals/[id]` | DELETE | Delete a portal |
| `/api/portals/upload` | POST | Upload a PDF to Supabase Storage (max 50MB). Returns `{pdf_url, pdf_storage_path}` |

### Public Routes (no auth required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portals/public/[token]` | GET | Fetch portal by share token. Resolves storage paths to public URLs, loads all document content, increments view count |
| `/api/portals/analytics` | POST | Record an analytics event (`share_token`, `session_id`, `event_type` required) |
| `/api/portals/analytics` | GET | Retrieve aggregated analytics by `portal_id`. Returns sessions with duration, pages viewed, messages, tool usage |
| `/api/chat/portal` | POST | AI chat endpoint. Accepts `UIMessage[]` + portal headers |
| `/api/tts` | POST | Text-to-speech via Cartesia `sonic-turbo`. Accepts `{text, voice_id?}`. Max 2000 chars. Returns streamed MP3 audio |

---

## Voice Mode

Voice mode uses two separate systems:

**Speech-to-Text (STT):** Web Speech API (`SpeechRecognition`). Continuous mode with a 1.5s silence timer that auto-sends the transcript when the user pauses.

**Text-to-Speech (TTS):** Cartesia API via `/api/tts` endpoint.
- Model: `sonic-turbo` (~40ms time-to-first-byte)
- Voice: "Jillian - Happy Spirit" (configurable via `voice_id`)
- Output: MP3 128kbps 44100Hz, streamed directly to client
- Falls back to browser `speechSynthesis` if API fails
- Barge-in support: stops TTS playback when user starts speaking
- Strips markdown and truncates at 600 chars before speaking

---

## Analytics

Client-side tracking via `PortalTracker` (`src/lib/portal-analytics.ts`):

**Events tracked:**
- `page_view` — which pages the viewer navigates to
- `doc_open` — which documents are opened
- `message` — chat messages sent (text length only, not content)
- `tool_use` — which AI tools are triggered
- `voice_activated` — voice mode usage

**Flush behavior:** Events queue in memory and flush every 30 seconds. On tab close, `navigator.sendBeacon` ensures delivery. Events are sent individually (not batched).

**Dashboard** at `/portal/[token]/analytics` shows:
- Total sessions, average duration, pages viewed, messages sent
- Per-session breakdown with tool usage and voice badges

---

## Data Model

Portals are stored in the `document_portals` Supabase table:

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Primary key |
| `org_id` | uuid | Organization owner |
| `created_by` | uuid | User who created the portal |
| `title` | text | Portal title |
| `subtitle` | text | Subtitle shown on splash screen |
| `client_name` | text | Client name shown on splash and welcome modal |
| `share_token` | text | Public share token (auto-generated) |
| `is_public` | boolean | Whether the portal is publicly accessible |
| `pdf_storage_path` | text | Path in Supabase Storage `portals` bucket |
| `document_content` | text | Inline document text (alternative to PDF) |
| `context_item_id` | uuid | FK to `context_items` for document content |
| `documents` | jsonb | Array of `{id, title, context_item_id, is_active, pdf_path}` for multi-doc portals |
| `brand_color` | text | Primary brand color (default: `#34d399`) |
| `brand_secondary_color` | text | Secondary brand color |
| `logo_url` | text | Client logo URL |
| `audio_storage_path` | text | Voiceover audio path |
| `system_prompt` | text | Custom AI system prompt override |
| `enabled_tools` | text[] | Which AI tools are active |
| `model` | text | AI model ID (default: `google/gemini-3-flash`) |
| `hide_chrome` | boolean | Hide portal navigation chrome |
| `default_expanded` | boolean | Start with chat expanded |
| `client_context` | text | Client-specific context for AI personalization |
| `password_hash` | text | Optional password protection |
| `view_count` | integer | Total views |
| `last_viewed_at` | timestamp | Last view timestamp |

PDFs are stored in Supabase Storage under the `portals` bucket at path `{org_id}/{timestamp}-{filename}.pdf`.

---

## Known Issues

1. **`highlight_text` tool defined twice** — second definition silently overwrites first, losing the `reason` parameter
2. **`portal-chat.tsx` is dead code** — component exists but is never imported; `PortalViewer` uses `ChatInterface` instead
3. **Analytics endpoints have no auth** — anyone with a `portal_id` UUID or share token can read engagement data
4. **TTS endpoint has no auth or rate limiting** — publicly callable, could burn Cartesia API credits
5. **`capture_screen` tool is cosmetic** — triggers a CSS flash but doesn't capture pixels
6. **`share_feedback` tool is a stub** — no email integration
7. **`BLUEWAVE_DOCUMENTS` hardcoded** in portal-viewer — client-specific document library not yet generalized
8. **Analytics events not batched** — each event is a separate HTTP POST
9. **Voice waveform is cosmetic** — uses `Math.random()` heights, not real audio levels
10. **Model default inconsistency** — `POST /api/portals` defaults to `google/gemini-3-flash`, chat route defaults to `google/gemini-3.0-flash`
11. **"Granger" stale name** in portal layout title — should be updated

---

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **AI**: Vercel AI SDK (`ai` package) — `ToolLoopAgent`, `createAgentUIStreamResponse`, `tool`, `generateText`
- **Models**: Google Gemini 3 Flash (default), configurable per portal
- **Database**: Supabase (PostgreSQL + Storage + Auth)
- **PDF**: `react-pdf` with `pdfjs-dist` worker
- **TTS**: Cartesia `sonic-turbo`
- **STT**: Web Speech API (browser-native)
- **Charts**: Chart.js (rendered in sandboxed iframes)
- **Styling**: Tailwind CSS v3
- **Components**: shadcn/ui
