# Interactive Document Portal (Proposal Viewer)

> Shareable, interactive page for viewing, chatting about, and visualizing documents.
> First use case: BlueWave proposal. System is fully dynamic — works for any document.
> This is essentially a duplicate of our main chat page with guard rails, a PDF viewer, and a focused UX.

---

## User's Full Vision (Verbatim Requirements)

### Core Concept
An interactive portal for viewing proposals/documents. Recipients get a full conceptual understanding through any method: reading, conversating, visualizing, researching claims, hearing it audibly. Shareable like our existing share pages (black background blur overlay style).

### PDF Viewer
- PDF rendered using a React PDF tool (like pdfx / react-pdf)
- Two-page spread on desktop, easily scrollable
- Table of contents for the PDF
- Play button for pre-generated audio narration
- On mobile: single page view

### Chat System
- Chat bar at the bottom of the page
- Chat window is a rectangle matching the PDF viewer width, opens upward
- This is our chat but with a different view — a smaller, contained rectangle
- Expandable: tap to expand into a 65/35 split (PDF left, chat right, PDF switches to single page)
- Context-aware: knows the document name, client name, content
- Dynamic title showing the document/client name in a different color
- Guard-railed: only specific tools available, with toggles to enable/disable each one

### Guard Rails & Tool Toggles
- Only allowed tools are available (no full tool suite)
- Perplexity (web search) with toggle to turn on/off
- Chart/graph rendering in chat
- PDF navigation (go to page, find text, highlight matches)
- List of all available tools in the prompt window with toggles
- This is for testing and control — isolate tools, remove search, etc.
- Toggle to hide/show sidebar and top bar (distraction-free mode)

### Text Interaction (Bubble Menu)
- Highlight text in PDF → bubble menu appears with options:
  - "Send to Chat" — adds highlighted text as a context tag in the chat input
  - "Visualize" — AI generates visualization of the highlighted data
  - Other options: "Explain", "Research" (web search for claims)
- Context tags appear as chips/bubbles above or in the chat input
  - On hover: show preview popup of the full highlighted text (like citation hover in main chat)
  - Click X to remove
  - Up to 5 context tags at a time (depends on context limits)

### PDF Navigation via Chat
- User can ask "find me the section about X" → AI highlights that text in the PDF
- Left/right arrows in chat UI to navigate between search matches
- User can ask "go to page 5" or "what page talks about Y"
- AI can navigate the PDF programmatically

### Audio
- Pre-generated audio clip (MP3) — provided, not generated each time
- Play button in the header area
- Future: generate audio via TTS for any document

### Presentation Mode
- AI generates an animated branded flow of the document content
- GSAP/CSS animations, branded to the client (colors, logo)
- Scrollytelling or slide-based format
- "Visualize all of this" concept — replace PDF with animated visualization

### Dynamic System
- Works for ANY document, not just BlueWave
- DB-driven: document metadata, tools config, branding, system prompt
- For this demo: BlueWave-specific content, but all stored in DB so it's reusable
- Creating a portal = loading a document + setting variables (client name, branding, tools)
- Could use a model to recreate PDFs in React using the PDF tool
- System prompt is specific to the client/document context

### UI Details
- Page has the same black background blur overlay style as our share pages
- Document/client name displayed prominently, possibly in brand color
- Toggle for distraction-free mode (hide sidebar, top bar)
- All tool toggles visible in the prompt bar area
- Compact chat mode (default) vs expanded mode (65/35 split)

---

## Page Layout

### Compact Mode (Default)
```
┌─────────────────────────────────────────────┐
│ [Logo] BlueWave Scope of Work    [🔊] [TOC] │
│         [Hide UI toggle] [Expand ↗]         │
├─────────────────────────────────────────────┤
│                                             │
│          PDF Viewer (2-page spread)         │
│          Scrollable, zoomable               │
│          Page 3 of 12                       │
│                                             │
│  [Highlighted text → bubble menu]           │
│                                             │
├─────────────────────────────────────────────┤
│ Context tags: [§ Revenue projections ×]     │
│ Tool toggles: [✓Search] [✓Charts] [✓Nav]   │
│ ┌─────────────────────────────────────────┐ │
│ │ Chat messages (compact, same width)     │ │
│ │ - User: What's the timeline?            │ │
│ │ - AI: Based on page 4, the timeline...  │ │
│ └─────────────────────────────────────────┘ │
│ [Chat input.......................] [Send]   │
└─────────────────────────────────────────────┘
```

### Expanded Mode (Click expand)
```
┌────────────────────────────┬────────────────┐
│                            │                │
│   PDF Viewer               │   Chat         │
│   (single page, 65%)       │   (35%)        │
│                            │                │
│   Scrollable               │   [messages]   │
│   TOC sidebar (optional)   │                │
│                            │   [context]    │
│                            │   [toggles]    │
│                            │   [input]      │
└────────────────────────────┴────────────────┘
```

---

## Data Model

```sql
CREATE TABLE document_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Document info
  title TEXT NOT NULL,
  subtitle TEXT,
  client_name TEXT,
  context_item_id UUID REFERENCES context_items(id),
  pdf_storage_path TEXT,          -- Supabase Storage path for PDF
  document_content TEXT,          -- Full text content for AI context

  -- Branding
  brand_color TEXT DEFAULT '#34d399',
  brand_secondary_color TEXT,
  logo_url TEXT,

  -- Audio
  audio_storage_path TEXT,        -- Supabase Storage path for audio

  -- AI Configuration
  system_prompt TEXT,             -- Override system prompt
  enabled_tools JSONB DEFAULT '["search_document", "navigate_pdf", "render_chart", "web_search"]',
  model TEXT DEFAULT 'google/gemini-3-flash',

  -- UI Configuration
  hide_chrome BOOLEAN DEFAULT false,  -- Hide sidebar/topbar by default
  default_expanded BOOLEAN DEFAULT false,

  -- Access
  share_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_public BOOLEAN DEFAULT true,
  password_hash TEXT,             -- Optional password protection

  -- Analytics
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_portal_token ON document_portals(share_token);
CREATE INDEX idx_portal_org ON document_portals(org_id);
```

---

## Tools Available in Portal Chat

Each tool has a toggle (on/off) in the prompt bar.

| Tool | Description | Default |
|------|-------------|---------|
| `search_document` | Find text in the PDF, return page numbers and excerpts | On |
| `navigate_pdf` | Go to a specific page, scroll to a section | On |
| `render_chart` | Generate Chart.js/inline HTML visualizations from data | On |
| `web_search` | Search the web via Perplexity/Tavily for fact-checking | Off |
| `highlight_text` | Highlight specific text in the PDF viewer | On |
| `get_page_content` | Get the full text of a specific page | On |
| `summarize_section` | Summarize a section of the document | On |

---

## System Prompt Template

```
You are a document assistant for {client_name}. You are helping the reader
understand "{document_title}".

You have access to the full document content. When answering questions:
1. Always reference specific pages and sections
2. Quote relevant text when helpful
3. If asked to find something, use search_document and highlight the results
4. If asked about data, offer to visualize it with render_chart
5. Be concise but thorough — this is a professional document review

Document: {document_title}
Client: {client_name}
Pages: {page_count}

Full document content:
{document_content}
```

---

## Implementation Plan

### Phase 1: Core Structure
1. DB migration: `document_portals` table
2. `/portal/[token]/page.tsx` — public page route (no auth required)
3. PDF viewer component using `react-pdf` (pdfjs-dist)
4. Compact chat component (rectangle, same width as viewer)
5. `/api/chat/portal/route.ts` — guard-railed chat with document context
6. Portal-specific tools (search_document, navigate_pdf, get_page_content)
7. BlueWave demo data seeded in DB

### Phase 2: Chat Features
8. Tool toggles in prompt bar (checkboxes for each tool)
9. Expand/collapse chat (compact ↔ 65/35 split)
10. Context tags from highlighted text (chips with hover preview)
11. Chart/graph rendering in chat messages (reuse inline HTML system)
12. Distraction-free toggle (hide sidebar/topbar)

### Phase 3: PDF Interaction
13. Text selection → bubble menu (Send to Chat, Visualize, Explain, Research)
14. PDF search with highlight (find text, navigate matches with arrows)
15. Table of contents extraction and sidebar
16. Page indicator and navigation controls
17. Zoom controls

### Phase 4: Rich Features
18. Audio player (pre-generated MP3, play/pause in header)
19. Presentation mode (AI-generated animated branded flow)
20. PDF recreation in React (for dynamic document generation)
21. Portal creation UI (select document → configure → generate share link)
22. Analytics (view count, chat interactions, time spent)
23. Password protection option

---

## Tech Stack

- **PDF Viewing**: `react-pdf` (pdfjs-dist) — renders PDF pages as canvas/SVG
- **PDF Text Layer**: pdfjs-dist text layer for selection + highlighting
- **Charts**: Chart.js via inline HTML (existing system)
- **Audio**: HTML5 Audio element
- **Chat**: Vercel AI SDK v6 streamText with guard-railed tools
- **Model**: Gemini Flash (default, configurable per portal)
- **Storage**: Supabase Storage for PDFs and audio files
- **Search**: Perplexity API or Tavily for web search tool

---

## BlueWave Demo Setup

For the initial demo:
- `client_name`: "BlueWave"
- `title`: "Scope of Work — BlueWave Aqueduct v2"
- `brand_color`: "#0066CC" (blue)
- PDF: Upload the BlueWave scope document
- Audio: Pre-generated narration MP3 (user will provide)
- System prompt: BlueWave-specific context
- Enabled tools: all on except web_search
- Share URL: `/portal/{token}` — publicly accessible

---

## Relationship to Existing System

This portal is essentially a **specialized view of our chat system**:
- Same AI SDK infrastructure (streamText, tools, AI Gateway)
- Same inline HTML rendering (charts, visualizations)
- Same message rendering (markdown, code blocks)
- Different layout (PDF viewer + compact chat vs full-screen chat)
- Different tool set (guard-railed, toggleable)
- Different access model (public share link, no auth required)
- Reusable for any document, any client, any branding
