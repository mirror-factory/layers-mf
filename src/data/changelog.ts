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
