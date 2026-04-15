export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
  changes: {
    type: "feat" | "fix" | "docs" | "refactor";
    description: string;
  }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "0.8.1",
    date: "2026-04-15",
    title: "Sharing API, Chat History Search & Conversation Branching",
    highlights: [
      "Sharing API now supports the content_shares table with resource_type, scope, and granular permissions (view/edit/admin)",
      "New search_chat_history tool lets the AI search through past conversations by text matching",
      "New branch_conversation tool creates conversation forks by copying messages to a new thread",
    ],
    changes: [
      { type: "feat", description: "Sharing API: added resource share schema supporting artifact, conversation, context_item, and collection resource types with user/org scoping" },
      { type: "feat", description: "Sharing [id] route: added org_members check and expanded permission levels to include view, edit, and admin" },
      { type: "feat", description: "search_chat_history tool: search chat_messages by text within the user's org, returns conversation context and message snippets" },
      { type: "feat", description: "branch_conversation tool: fork conversations by copying messages up to a specified index into a new conversation with 'branch' origin" },
      { type: "feat", description: "Sharing API tests: 7 tests covering auth, share creation, field validation, scope rules, and self-sharing prevention" },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-04-13",
    title: "Portal Analytics, 105 Tests & Developer Documentation",
    highlights: [
      "Portal analytics: track viewer behavior (pages viewed, docs opened, messages, tool usage, voice) with sender dashboard",
      "105 new tests covering portal API route, 4 component test suites, analytics tracker, and E2E across 5 viewports",
      "Comprehensive portal documentation: theming guide, 20-tool reference, developer guide, and 988-line system overview",
    ],
    changes: [
      // Analytics
      { type: "feat", description: "Portal analytics tracker: client-side event collection with sendBeacon, 30s auto-flush, session management" },
      { type: "feat", description: "Portal analytics API: POST to record events, GET to retrieve aggregated session summaries" },
      { type: "feat", description: "Portal analytics dashboard component: stat cards, session timeline, tool usage breakdown" },
      { type: "feat", description: "Supabase migration for portal_analytics table with indexes and RLS policies" },
      { type: "feat", description: "Portal viewer integration: auto-tracks page views, doc opens, voice activation, tool outputs" },

      // Tests
      { type: "feat", description: "Portal chat route tests: 50 tests covering validation, model selection, intent detection, helper functions" },
      { type: "feat", description: "PortalSplash tests: 8 tests for branding, timing, fade lifecycle, logo rendering" },
      { type: "feat", description: "PortalOnboarding tests: 9 tests for step progression, dismissal, sessionStorage persistence" },
      { type: "feat", description: "PortalAnnotationOverlay tests: 10 tests for visibility, expansion, grouping, type rendering" },
      { type: "feat", description: "PortalVoiceMode tests: 15 tests for state management, toggle, inline mode, brand color" },
      { type: "feat", description: "Portal analytics tracker tests: 13 tests for session IDs, event tracking, auto-flush, error handling" },
      { type: "feat", description: "E2E portal tests: added dark/light mode toggle and mobile landscape viewport tests" },

      // Documentation
      { type: "docs", description: "Portal guide: theming (brand colors, ChatVariant, splash), all 20 tools with schemas, developer reference" },
      { type: "docs", description: "System overview: 988-line comprehensive architecture map, updated for v0.7.1 fixes and test coverage" },
      { type: "docs", description: "Handoff document: complete session summary from April 9-12 portal build" },
    ],
  },
  {
    version: "0.7.1",
    date: "2026-04-12",
    title: "Portal Polish: Race Condition Fix, Model Upgrade & Dark Mode",
    highlights: [
      "Fixed highlight-after-doc-switch race condition — highlights now reliably appear after switching documents",
      "Upgraded portal AI model from Gemini 3.1 Flash Lite to Gemini 3.0 Flash for better tool selection",
      "Fixed DOCX dark mode text visibility — forced dark text on white pages to prevent invisible headers",
    ],
    changes: [
      { type: "fix", description: "Highlight race condition: reset pdfControls on document switch and rely on useEffect guard instead of stale setTimeout closures" },
      { type: "fix", description: "DOCX dark mode: force dark text color on white DOCX pages so light-gray inline styles are always readable" },
      { type: "feat", description: "Upgraded portal AI model from gemini-3.1-flash-lite to gemini-3.0-flash for improved tool selection accuracy" },
      { type: "refactor", description: "Simplified highlight application: immediate apply when PDF loaded, deferred via useEffect when not" },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-04-10",
    title: "Portal Experience: Voice Mode, Document Library & 20+ AI Tools",
    highlights: [
      "Voice mode with Cartesia TTS — speak to the AI and it speaks back using sonic-turbo",
      "Document library as default landing page with two-column spread for PDFs and DOCX",
      "20+ AI tools for document interaction: highlight, navigate, chart, walkthrough, bookmark, compare, brief, and more",
      "AI Elements integration (Conversation, Suggestions, Shimmer) with ChatVariant config system",
      "3-position chat layout (corner, sidebar, center) with quick actions bar and guided onboarding",
    ],
    changes: [
      // Voice & Audio
      { type: "feat", description: "Voice mode: speech-to-text input with microphone button and Cartesia sonic-turbo TTS for AI responses" },
      { type: "feat", description: "Cartesia TTS integration: low-latency text-to-speech with streaming audio playback" },

      // Document Library & Rendering
      { type: "feat", description: "Document library as default landing page — browse and open documents before chatting" },
      { type: "feat", description: "Two-column spread layout for PDFs and DOCX files (side-by-side page view)" },
      { type: "feat", description: "DOCX rendering via docx-preview with edge-to-edge layout and proper two-column support" },
      { type: "feat", description: "Excel rendering with Jspreadsheet CE for interactive spreadsheets, HTML table fallback for read-only" },
      { type: "feat", description: "PDF highlight with overlay divs and sweep animation for AI-referenced passages" },

      // AI Tools (20+)
      { type: "feat", description: "20+ AI tools for document interaction: highlight, navigate, chart, walkthrough, bookmark, compare, brief, capture, track reading, share feedback" },
      { type: "feat", description: "Intent detection system: automatically selects the right AI tool based on user message content" },
      { type: "feat", description: "Quick actions bar with one-click Summarize, Timeline, Budget, and Compare buttons" },

      // Chat & UI System
      { type: "feat", description: "AI Elements integration: Conversation, Suggestions, and Shimmer components for polished chat experience" },
      { type: "feat", description: "ChatVariant config system for reusable chat configurations across different contexts" },
      { type: "feat", description: "3-position chat layout: corner (floating), sidebar (docked), and center (full-width) modes" },

      // Onboarding & Branding
      { type: "feat", description: "Guided onboarding: 3-step tutorial that walks new users through the portal experience" },
      { type: "feat", description: "Splash screen with Mirror Factory branding and smooth entry animation" },
      { type: "feat", description: "BlueWave icon-only SVG for compact header logo display" },

      // Theme & Responsive
      { type: "feat", description: "Light/dark mode with proper contrast ratios across all portal components" },
      { type: "feat", description: "Mobile responsive layout: bottom-sheet chat, compact document cards, touch-friendly controls" },

      // Fixes
      { type: "fix", description: "Light mode slate palette corrected for proper text contrast and readability" },
      { type: "fix", description: "TypeScript errors in Jspreadsheet integration resolved (type definitions and imports)" },
      { type: "fix", description: "Chat history persistence: conversations saved and restored across sessions" },
      { type: "fix", description: "DOCX preview padding removed for proper edge-to-edge document rendering" },
      { type: "fix", description: "Doc info bar removed to maximize document viewing area" },
      { type: "fix", description: "Portal header logo uses icon-only SVG instead of full wordmark for compact display" },
      { type: "fix", description: "Mobile bottom-sheet chat positioning and interaction fixes" },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-04-07",
    title: "MCP-First Architecture, Chat Tool Management & Avatar Overhaul",
    highlights: [
      "Full MCP tool management from chat: search, connect, disconnect, list servers",
      "Inline OAuth and API key cards — connect integrations without leaving chat",
      "Removed Nango — all integrations now powered by MCP servers",
      "New NeuralMorph orbit avatars with color support (white for user, green for AI)",
      "Notifications consolidated into single /notifications page",
    ],
    changes: [
      // MCP Tools
      { type: "feat", description: "search_mcp_servers: search 3 registries (official, Smithery, curated) from chat" },
      { type: "feat", description: "connect_mcp_server: add servers from registry results or pasted URLs" },
      { type: "feat", description: "disconnect_mcp_server: remove MCP servers by name from chat" },
      { type: "feat", description: "list_mcp_servers: show all connected servers with status and tools" },
      { type: "feat", description: "Inline OAuth card: discovers endpoints, generates PKCE, redirects to provider directly" },
      { type: "feat", description: "Inline API key card: paste token in chat, connects immediately" },
      { type: "feat", description: "OAuth callback returns to /chat instead of connectors page" },
      // MCP Fixes
      { type: "fix", description: "MCP OAuth column mismatch: token_url/client_id now read correctly from DB" },
      { type: "fix", description: "MCP reconnect: OAuth servers trigger auth flow instead of page reload loop" },
      { type: "fix", description: "MCP PATCH/DELETE use admin client to bypass RLS (disconnect actually works now)" },
      { type: "fix", description: "MCP tool loading: per-server error logging, error_message surfaced in UI" },
      { type: "fix", description: "OAuth discovery uses server-side proxy to avoid CORS failures" },
      // Nango Removal
      { type: "refactor", description: "Removed Nango entirely — 12,800 lines deleted across 67 files" },
      { type: "refactor", description: "Removed 12 Nango-dependent AI tools and 5 specialist agents" },
      { type: "refactor", description: "Connectors page now MCP-only (no more credential cards)" },
      { type: "refactor", description: "Simplified createTools() — no more clients or permissions params" },
      // Avatar & UI
      { type: "feat", description: "NeuralMorph color prop: white user avatar, green AI avatar with orbit formation" },
      { type: "feat", description: "Sidebar logo: NeuralMorph orbit replaces old NeuralDots" },
      { type: "feat", description: "Model selection persists to localStorage across refreshes" },
      { type: "feat", description: "Chat auto-focus: textarea focused on mount and conversation switch" },
      { type: "fix", description: "Sidebar jitter: collapsed state initialized from localStorage (no flash)" },
      { type: "fix", description: "Share panel: moved out of dead code block, now renders when triggered" },
      { type: "fix", description: "Image attachments right-aligned for user messages" },
      // Notifications
      { type: "feat", description: "Consolidated /inbox and /notifications into single route" },
      { type: "feat", description: "Schedule notifications: started + complete dual notifications" },
      { type: "feat", description: "Notification bell 'View all' links to /notifications (same data source)" },
      // Connectors
      { type: "feat", description: "Connectors mini-chat: discover and connect MCP servers conversationally on the connectors page" },
      { type: "feat", description: "Disconnect vs Remove: disconnect deactivates (can reconnect), remove deletes permanently" },
      { type: "fix", description: "MCP disconnect/reconnect now works (RLS bypass, field name fix, 404 handling)" },
      // Infrastructure
      { type: "refactor", description: "Removed @nangohq/node and @nangohq/frontend packages" },
      { type: "fix", description: "All 49 tests passing (content-lifecycle Math.floor fix)" },
      { type: "fix", description: "iOS safe areas: contentInset set to 'never' (was 'automatic', doubled padding)" },
      { type: "fix", description: "Vercel deploy: cron schedule adjusted for Hobby plan, lockfile regenerated" },
      // Docs
      { type: "docs", description: "Media types doc: file support matrix per model (images, PDF, text)" },
      { type: "docs", description: "Browserbase roadmap item: browser automation for AI agents" },
      { type: "docs", description: "Overview page updated: MCP-only connectors, Smithery registry" },
    ],
  },
  {
    version: "0.5.1",
    date: "2026-04-07",
    title: "iOS Push Notifications",
    highlights: [
      "Native iOS push notifications via APNs with JWT authentication",
      "Push notifications sent when scheduled tasks complete",
      "Automatic cleanup of expired/invalid device tokens",
    ],
    changes: [
      { type: "feat", description: "iOS push notifications: APNs integration with JWT-based (p8 key) authentication" },
      { type: "feat", description: "Device token registration: stores tokens per user with auto-cleanup of invalid ones" },
      { type: "feat", description: "Schedule executor now sends push notifications when background tasks complete" },
      { type: "feat", description: "Push send API: internal endpoint for cron jobs to trigger push delivery" },
      { type: "feat", description: "iOS entitlements and background modes configured for remote notifications" },
      { type: "feat", description: "AppDelegate forwards APNs tokens to Capacitor Push Notifications plugin" },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-04-07",
    title: "Mobile Optimization, Cost Tracking, MCP Gallery & Auto-Registry",
    highlights: [
      "Per-message cost tracking with prompt caching (90% savings on cached tokens)",
      "Mobile-optimized chat with full-screen artifacts and consolidated toolbar",
      "MCP gallery with 6,000+ servers from Smithery registry + auth type filters",
      "Scheduling system with background chats, notifications, and date/time picker",
      "Auto-registry system: convention-over-configuration for tools, docs, and tests",
    ],
    changes: [
      // Cost & Tracking
      { type: "feat", description: "Per-message cost tracking: model, TTFT, tokens, cache stats, cost per message" },
      { type: "feat", description: "Prompt caching via AI Gateway (90% savings on Anthropic/Google, 50% on OpenAI)" },
      { type: "feat", description: "Analytics dashboard: cost by provider, model usage, cache performance, top tools" },
      { type: "feat", description: "Usage analytics API with period/group-by filters" },
      { type: "feat", description: "Context tracker: expandable cost breakdown per LLM call" },

      // Mobile
      { type: "feat", description: "Mobile chat: consolidated prompt bar, small avatar dots, full-screen sidebar" },
      { type: "feat", description: "Mobile artifacts: full-screen overlay with simplified toolbar and three-dot menu" },
      { type: "feat", description: "iOS safe area support (edge-to-edge content, dark background in notch area)" },
      { type: "feat", description: "Android platform added (Capacitor) with dark theme" },

      // MCP & Connectors
      { type: "feat", description: "MCP gallery: Smithery registry (6,000+ servers) + official registry + curated list" },
      { type: "feat", description: "Auth type filters on MCP browse (OAuth, API Key, No Auth)" },
      { type: "feat", description: "MCP protocol version fallback (tries 4 versions x 2 transports)" },
      { type: "feat", description: "Connectors page redesign: tab-based layout, inline detail views" },
      { type: "feat", description: "Nango removed: direct OAuth + API keys + MCP replace third-party dependency" },

      // Scheduling & Notifications
      { type: "feat", description: "Scheduling: date/time picker (no cron syntax), cron presets, validation" },
      { type: "feat", description: "Background chat execution: AI runs prompts on schedule, creates conversations" },
      { type: "feat", description: "Notification bell with desktop ping sound (Web Audio API)" },
      { type: "feat", description: "Chat message queue: send messages while AI is still responding" },

      // Local Models
      { type: "feat", description: "Ollama/Gemma 4 26B: local model support with slim system prompt" },
      { type: "feat", description: "Model warmup: keep_alive prevents 15-20s cold start on local models" },
      { type: "feat", description: "Local models hidden on production, default on localhost" },

      // Auto-Registry & Docs
      { type: "feat", description: "Tool metadata registry (_metadata.ts) with auto-generated docs" },
      { type: "feat", description: "Docs restructured into domain folders (chat/, artifacts/, library/, etc.)" },
      { type: "feat", description: "Master roadmap with 19 priority areas" },
      { type: "feat", description: "Cost observability architecture doc with per-provider caching details" },

      // Pages
      { type: "feat", description: "/overview: AI hero background, real component demos, analytics dashboard" },
      { type: "feat", description: "/changelog: version timeline with collapsible changes" },
      { type: "feat", description: "/tools: searchable tool registry with category tabs" },
      { type: "feat", description: "Home page: Three.js particle animation background in mint" },
      { type: "feat", description: "AgentSwarm animation component for parallel tool visualization" },

      // Skills
      { type: "feat", description: "Skills: all emojis replaced with Lucide icons (30+ icon mappings)" },
      { type: "feat", description: "Skills create: 3-column layout, fixed redirects to chat" },
      { type: "feat", description: "Skills + MCP: inline detail views (no drawers)" },

      // Bug Fixes
      { type: "fix", description: "Thinking indicator shows immediately after sending (not blank screen)" },
      { type: "fix", description: "Chat persistence: auto-create conversation, await DB saves" },
      { type: "fix", description: "Public share links work for non-logged-in users" },
      { type: "fix", description: "Sandbox restart: correct column name (file_path), deterministic naming" },
      { type: "fix", description: "Artifact panel open action fetches and displays artifact data" },
      { type: "fix", description: "Circular JSON crash on tool output (error boundary + guarded stringify)" },
      { type: "fix", description: "Schedule run_count was silently failing (missing error_message column)" },
      { type: "fix", description: "daysBetween rounding issue in content lifecycle" },
      { type: "fix", description: "MCP disconnect actually deletes server (was only toggling isActive)" },
      { type: "fix", description: "Hydration mismatch from IS_LOCAL window check (moved to useEffect)" },
      { type: "fix", description: "Model label tracks actual model used, not current selector" },
      { type: "fix", description: "artifact_panel tool cards hidden (infrastructure, not user-facing)" },
      { type: "fix", description: "65 emojis removed from codebase (Lucide icons + plain text)" },
      { type: "fix", description: "Skills slash commands refresh after create_skill and create_tool_from_code" },
      { type: "fix", description: "Perplexity: system prompt instructs model to include source URLs" },

      // Docs
      { type: "docs", description: "4 architecture research docs (org, ingestion, content, sharing)" },
      { type: "docs", description: "Library hub + sharing architecture (product-level)" },
      { type: "docs", description: "Cost observability doc: end-to-end flow, analytics dimensions, pricing" },
      { type: "docs", description: "Local models doc: Ollama setup, performance, troubleshooting" },
      { type: "docs", description: "Auto-registry strategy: convention-over-configuration plan" },
      { type: "docs", description: "DB schema reference (40+ tables) + API reference (150+ endpoints)" },
      { type: "docs", description: "Tool registry doc (43 tools with schemas and categories)" },
      { type: "docs", description: "Notification event catalog (9 events, 5 delivery channels)" },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-04-06",
    title: "Content Organization, Sandbox Management & Product Overview",
    highlights: [
      "Collections, tags, pins, and archive system for organizing 1000+ knowledge items",
      "Per-artifact sandbox lifecycle management (start, stop, restart per artifact)",
      "Product overview showcase page at /overview",
      "Notification system foundation with bell in sidebar",
      "Content detail side panel in knowledge library",
    ],
    changes: [
      { type: "feat", description: "Collections sidebar with folders (3-level nesting), tags, smart collections, pins" },
      { type: "feat", description: "8 API routes for collections CRUD, tags CRUD, pin/archive" },
      { type: "feat", description: "Per-artifact sandbox management -- deterministic naming, start/stop/restart API" },
      { type: "feat", description: "/overview product showcase page with 10 sections" },
      { type: "feat", description: "Notification system -- DB, API, bell component in sidebar" },
      { type: "feat", description: "Content detail side panel in context library" },
      { type: "feat", description: "Add Integration dialog with OAuth + MCP options" },
      { type: "fix", description: "Chat persistence -- auto-create conversation, await saves" },
      { type: "fix", description: "Thinking indicator shows immediately after sending message" },
      { type: "fix", description: "Public share links work for non-logged-in users" },
      { type: "fix", description: "Sandbox restart uses correct column name (file_path)" },
      { type: "fix", description: "Sandbox deterministic naming prevents stale URL errors" },
      { type: "fix", description: "Skills slash commands refresh after create_skill" },
      { type: "fix", description: "Error handling with smart messages and Retry button" },
      { type: "fix", description: "Favicons on Perplexity web search citation pills" },
      { type: "fix", description: "Artifact panel open action fetches and displays artifact" },
      { type: "docs", description: "4 architecture research docs (org, ingestion, content org, sharing)" },
      { type: "docs", description: "Library hub and sharing architecture doc" },
      { type: "docs", description: "Master roadmap with 15 priority areas" },
      { type: "docs", description: "Updated 3 existing docs with implementation status" },
      { type: "docs", description: "Archived 5 superseded docs" },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-04-05",
    title: "Sandbox Overhaul & Sharing System",
    highlights: [
      "Persistent sandboxes with per-artifact naming",
      "Public conversation share links",
      "Mobile UX fixes and unique chat URLs",
      "51 commits in a marathon session",
    ],
    changes: [
      { type: "feat", description: "Persistent sandboxes via @vercel/sandbox@beta" },
      { type: "feat", description: "Artifact auto-open, version history, delete" },
      { type: "feat", description: "Public chat share links with /share/[token] page" },
      { type: "feat", description: "Model selector fix -- dynamic ref for x-model header" },
      { type: "feat", description: "Artifact context injection (AI knows which artifact is open)" },
      { type: "fix", description: "Mobile scroll, sticky prompt bar, placeholder ellipsis" },
      { type: "fix", description: "Unique chat URLs (/chat/[id])" },
      { type: "fix", description: "Sandbox name mismatch in edit_code" },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-04-03",
    title: "13 Epics -- Library, Connectors, Skills & More",
    highlights: [
      "Knowledge library UI overhaul (Finder-style)",
      "MCPConnectionManager with OAuth auto-refresh",
      "AI classification pipeline",
      "Sharing system with content_shares table",
    ],
    changes: [
      { type: "feat", description: "Library UI overhaul -- Finder-style 3-column layout" },
      { type: "feat", description: "MCPConnectionManager singleton with auto-refresh" },
      { type: "feat", description: "AI classification pipeline (classifyContent + cron)" },
      { type: "feat", description: "Gemini embeddings (text-embedding-004) primary" },
      { type: "feat", description: "Connectors page -- consolidated MCP + API" },
      { type: "feat", description: "Sharing system -- content_shares, share dialog" },
      { type: "feat", description: "Tool result cards with citation bar" },
      { type: "feat", description: "Context engineering -- system prompt caching" },
      { type: "feat", description: "Skill upload (.skill/.json parsing)" },
      { type: "feat", description: "Capacitor iOS app shell" },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-04-02",
    title: "Foundation -- Chat, Artifacts & Inline Visuals",
    highlights: [
      "Agentic chat with ToolLoopAgent and 9 models",
      "Universal artifact system (code, documents, sandboxes)",
      "Inline HTML visuals in chat (Chart.js, GSAP, anime.js)",
      "NeuralDots/NeuralMorph avatar system",
    ],
    changes: [
      { type: "feat", description: "Agentic chat with ToolLoopAgent + AI Gateway" },
      { type: "feat", description: "Universal artifact system -- versioning, file tree, preview" },
      { type: "feat", description: "Inline HTML rendering with 7 JS libraries" },
      { type: "feat", description: "NeuralDots + NeuralMorph avatar with 25 formations" },
      { type: "feat", description: "Slash command menu + visual frequency control" },
      { type: "feat", description: "Context window bar with token counting" },
    ],
  },
];
