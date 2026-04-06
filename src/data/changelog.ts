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
