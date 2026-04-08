# Portal Bugs & Fixes Needed

> Tracking all known issues from testing session April 7-8, 2026

## Critical Layout Issues

### 1. Expanded (65/35) view — chat not full height
The chat panel in the 35% sidebar doesn't fill the full viewport height. There's dead space at the bottom. The chat container needs `h-full` or `h-screen` minus the header height.

### 2. Expanded view — tool toggle pills still showing
The Search/Navigate/Page/Charts/Summarize/Highlight pills are still visible at the top of the chat in expanded mode. These should be moved to a dropdown menu or removed from this view entirely.

### 3. Chat state not persisting between compact/expanded
When switching between compact (floating popup) and expanded (65/35 split), the chat messages are lost. This is because two separate ChatInterface instances are rendered. Need to either:
- Share the same ChatInterface instance (move it up and render conditionally in different containers)
- Or persist messages via a shared conversation ID

### 4. Expanded view — PDF and chat scroll together
In the 65/35 split, the PDF viewer and chat panel should scroll independently. Currently they scroll as one page. The chat panel needs `overflow-y-auto` with a fixed height, and the PDF viewer needs its own scroll container.

## Functional Issues

### 5. Presentation mode — next page flashes
Clicking next in presentation mode causes the page to flash/flicker instead of smooth transition. Likely a re-render issue with the PDF component. May need to preload the next page or use CSS transitions.

### 6. Search highlights wrong location
PDF search highlights appear in the top-left corner of each page instead of at the matching text location. The highlight DOM manipulation isn't finding the correct text spans in the react-pdf text layer.

### 7. Conversation sidebar needed
Users may want to start new conversations within the portal. Need a minimal conversation sidebar or at least a "New chat" button. Currently there's no way to start a fresh conversation without refreshing.

## UX Polish

### 8. Tool toggles should be in a menu
The tool toggle pills (Search, Navigate, Page, Charts, etc.) take up too much space. Move to a dropdown/popover menu accessible from a single button in the header.

### 9. Chat prompt placeholder should be contextual
Currently shows "Ask anything... (type / for commands)" — should show "Ask about [document title]..." without the slash command hint.

### 10. Empty space below prompt bar
The chat area shows dead space between the prompt bar and the bottom of the container. The prompt should be at the very bottom.
