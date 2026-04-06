# Tool Result Cards — Design System

> Status: Planning
> Last updated: 2026-04-02

---

## 1. What This Is

A **Universal Tool Result Card** — a single, branded component that renders the output of ANY tool call in the chat. Currently tool results are inconsistent: some show as JSON, some as custom cards, some as text. This standardizes everything.

## 2. The Card Anatomy

```
┌─────────────────────────────────────────────────┐
│ [NeuralDots 16px] Tool Label        source/model│  ← Header
├─────────────────────────────────────────────────┤
│                                                 │
│  Main content (varies by tool type)             │  ← Body
│  - Web search: formatted results                │
│  - Linear: issue cards                          │
│  - Email: message preview                       │
│  - Code: syntax highlighted                     │
│                                                 │
├─────────────────────────────────────────────────┤
│ 🌐 source1.com  📄 source2.com  🔗 source3.com │  ← Citations
│                                                 │
│ [hover on any source → live preview popup]      │
│ [click "Read" → sends to web_browse tool]       │
└─────────────────────────────────────────────────┘
```

## 3. Design Specs

### Header
- Left: NeuralDots (16px, animated while loading, static when done) + tool label
- Right: source label (e.g., "perplexity/sonar", "linear", "gmail")
- Background: transparent
- Border-bottom: `1px solid rgba(255,255,255,0.04)`
- Padding: 8px 12px

### Body
- Content varies by tool type
- Markdown rendered for text content
- Tables for structured data
- Code blocks for code
- Padding: 12px

### Citations (for tools that return source URLs)
- Row of favicon + domain badges
- Each is a link that opens in new tab
- On hover: popup card with:
  - Page title (fetched via meta)
  - Preview image if available (og:image)
  - First 2 lines of description
  - "Ask Granger to read this" button
- Styling: pill badges with favicon, domain text in muted color

### States
| State | Header icon | Body |
|-------|------------|------|
| Running | NeuralDots (animated) | "Searching..." or skeleton |
| Completed | ✓ checkmark (mint) | Full content |
| Error | ✗ (red) | Error message |

## 4. Tool Types That Use This

| Tool | Card Label | Body Content | Citations |
|------|-----------|--------------|-----------|
| web_search | "Web Search" | Formatted results | Source URLs with favicons |
| web_browse | "Reading page" | Extracted text | Source URL |
| search_context | "Knowledge Base" | Matching documents | Document links |
| ask_linear_agent | "Linear" | Issues/tasks | Linear URLs |
| ask_gmail_agent | "Gmail" | Email previews | Thread links |
| ask_granola_agent | "Meetings" | Meeting summaries | Meeting links |
| ask_notion_agent | "Notion" | Page content | Notion URLs |
| ask_drive_agent | "Drive" | File list | Drive URLs |
| review_compliance | "Compliance Review" | Pass/fail checklist | Rule sources |
| artifact_list | "Artifacts" | Artifact cards | Artifact links |
| list_approvals | "Approvals" | Pending items | Approval links |

## 5. The Hover Preview Popup

When hovering over a citation link:
```
┌──────────────────────────────────┐
│ [favicon] example.com            │
│                                  │
│ Page Title Goes Here             │
│ First line of meta description   │
│ that gives context about the...  │
│                                  │
│ [🤖 Ask Granger to read this]   │
└──────────────────────────────────┘
```

- Positioned above the link (tooltip-style)
- Fetches meta info via `/api/link-preview?url=...` endpoint
- "Ask Granger to read this" button sends: "Read and summarize {url}"
- Fade in animation
- Max width: 320px

## 6. Implementation Plan

1. Create `ToolResultCard` component
2. Create `CitationBar` component with hover preview
3. Create `/api/link-preview` endpoint
4. Update ToolCallCard in chat-interface.tsx to use ToolResultCard
5. Add favicon fetching (Google's favicon service: `https://www.google.com/s2/favicons?domain=X`)
