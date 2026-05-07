import type { ToolMetadata } from "./_types";

/**
 * Static registry of metadata for all built-in tools.
 *
 * Tool implementations remain in tools.ts (closure dependencies on supabase, orgId, clients).
 * This metadata powers:
 *   - /api/tools/registry endpoint
 *   - /tools page
 *   - docs/generated/tools.md
 */
export const TOOL_METADATA: ToolMetadata[] = [
  // -- Knowledge --
  {
    name: "search_context",
    category: "knowledge",
    service: "supabase",
    access: "read",
    description:
      "Search knowledge base for documents, meetings, notes. Call first before answering.",
  },
  {
    name: "get_document",
    category: "knowledge",
    service: "supabase",
    access: "read",
    description:
      "Fetch full document content by ID. Use when search result needs deeper reading.",
  },
  {
    name: "ingest_github_repo",
    category: "knowledge",
    service: "supabase",
    access: "write",
    description:
      "Import a GitHub repo into the context library. Clones, reads key files, saves as searchable context.",
  },
  {
    name: "ai_sdk_reference",
    category: "knowledge",
    service: "supabase",
    access: "read",
    description:
      "Look up Vercel AI SDK and AI Elements patterns for building AI-powered apps.",
  },

  // -- Agents --
  {
    name: "list_linear_issues",
    category: "agents",
    service: "linear",
    access: "read",
    description:
      "Query Linear issues with filters. For tasks, status checks, assignments.",
  },
  {
    name: "create_linear_issue",
    category: "agents",
    service: "linear",
    access: "write",
    description: "Create Linear issue. Routes through approval queue.",
  },
  {
    name: "query_granola",
    category: "agents",
    service: "granola",
    access: "read",
    description: "Search Granola meeting notes and transcripts.",
  },
  {
    name: "search_gmail",
    category: "agents",
    service: "gmail",
    access: "read",
    description:
      "Search Gmail. Syntax: from:, subject:, newer_than:, is:unread.",
  },
  {
    name: "draft_email",
    category: "agents",
    service: "gmail",
    access: "write",
    description: "Draft Gmail email. Routes through approval queue.",
  },
  {
    name: "search_notion",
    category: "agents",
    service: "notion",
    access: "read",
    description: "Search Notion pages and databases.",
  },
  {
    name: "list_drive_files",
    category: "agents",
    service: "drive",
    access: "read",
    description: "List and search Google Drive files.",
  },
  {
    name: "ask_linear_agent",
    category: "agents",
    service: "linear",
    access: "read",
    description:
      "Delegate to Linear specialist. Use for ALL task/issue requests.",
  },
  {
    name: "ask_gmail_agent",
    category: "agents",
    service: "gmail",
    access: "read",
    description:
      "Delegate to the Gmail specialist agent for email-related requests.",
  },
  {
    name: "ask_notion_agent",
    category: "agents",
    service: "notion",
    access: "read",
    description:
      "Delegate to the Notion specialist agent for page/database queries.",
  },
  {
    name: "ask_granola_agent",
    category: "agents",
    service: "granola",
    access: "read",
    description:
      "Delegate to the Granola specialist agent for meeting transcript queries.",
  },
  {
    name: "ask_drive_agent",
    category: "agents",
    service: "drive",
    access: "read",
    description:
      "Delegate to the Drive specialist agent for file search and reading.",
  },
  {
    name: "ask_user",
    category: "agents",
    service: "client",
    access: "client-side",
    description:
      "Ask the user structured questions via interactive form. Client-side tool.",
    clientSide: true,
  },

  // -- Scheduling --
  {
    name: "schedule_action",
    category: "scheduling",
    service: "supabase",
    access: "write",
    description: "Schedule a recurring or one-time action.",
  },
  {
    name: "list_schedules",
    category: "scheduling",
    service: "supabase",
    access: "read",
    description: "List scheduled actions.",
  },
  {
    name: "edit_schedule",
    category: "scheduling",
    service: "supabase",
    access: "write",
    description:
      "Edit schedule: change name, timing, status (pause/resume).",
  },
  {
    name: "delete_schedule",
    category: "scheduling",
    service: "supabase",
    access: "write",
    description: "Delete a scheduled action permanently.",
  },

  // -- Code / Sandbox --
  {
    name: "run_project",
    category: "code",
    service: "sandbox",
    access: "write",
    description:
      "Create and run a multi-file project in a sandboxed VM.",
  },
  {
    name: "run_code",
    category: "code",
    service: "sandbox",
    access: "write",
    description:
      "Execute a script in a sandboxed VM. For computations, data processing, API testing.",
  },

  // -- Web --
  {
    name: "web_browse",
    category: "web",
    service: "web",
    access: "read",
    description:
      "Fetch a URL and extract text content. Use to read web pages, docs, articles.",
  },
  {
    name: "web_search",
    category: "web",
    service: "perplexity",
    access: "read",
    description:
      "Search the web for current information via Perplexity Sonar. Returns results with source citations.",
  },
  {
    name: "weather",
    category: "web",
    service: "web",
    access: "read",
    description: "Get the weather for a city.",
  },

  // -- Compliance / Approvals --
  {
    name: "review_compliance",
    category: "compliance",
    service: "supabase",
    access: "read",
    description:
      "Review content against org rules and priority documents.",
  },
  {
    name: "list_approvals",
    category: "approvals",
    service: "supabase",
    access: "read",
    description: "List pending approvals.",
  },
  {
    name: "propose_action",
    category: "approvals",
    service: "supabase",
    access: "write",
    description:
      "Propose write action to external services for approval.",
  },

  // -- Artifacts --
  {
    name: "artifact_list",
    category: "artifacts",
    service: "supabase",
    access: "read",
    description: "List artifacts. Filter by type, search by title.",
  },
  {
    name: "artifact_get",
    category: "artifacts",
    service: "supabase",
    access: "read",
    description:
      "Get artifact content and open it in the artifact viewer.",
  },
  {
    name: "artifact_version",
    category: "artifacts",
    service: "supabase",
    access: "read",
    description: "List or restore artifact versions.",
  },
  {
    name: "artifact_panel",
    category: "artifacts",
    service: "client",
    access: "client-side",
    description:
      "Open or close the artifact side panel. Client-side tool.",
    clientSide: true,
  },
  {
    name: "artifact_delete",
    category: "artifacts",
    service: "supabase",
    access: "write",
    description: "Delete an artifact.",
  },
  {
    name: "write_code",
    category: "artifacts",
    service: "supabase",
    access: "write",
    description:
      "Save a code file as an artifact with version history.",
  },
  {
    name: "edit_code",
    category: "artifacts",
    service: "supabase",
    access: "write",
    description:
      "Edit an existing code artifact using find/replace, creating a new version.",
  },
  {
    name: "express",
    category: "artifacts",
    service: "client",
    access: "read",
    description:
      "Generate animated dot pattern inline in chat.",
  },

  // -- Documents --
  {
    name: "create_document",
    category: "documents",
    service: "supabase",
    access: "write",
    description: "Create a new rich-text document artifact.",
  },
  {
    name: "edit_document",
    category: "documents",
    service: "supabase",
    access: "write",
    description: "Edit an existing document or artifact.",
  },

  // -- Skills --
  {
    name: "activate_skill",
    category: "skills",
    service: "supabase",
    access: "read",
    description:
      "Activate a skill to load its specialized instructions and tools.",
  },
  {
    name: "create_skill",
    category: "skills",
    service: "supabase",
    access: "write",
    description: "Create a new custom skill for the agent.",
  },
  {
    name: "create_tool_from_code",
    category: "skills",
    service: "sandbox",
    access: "write",
    description:
      "Create a custom tool by generating and testing code in a sandbox.",
  },
  {
    name: "search_skills_marketplace",
    category: "skills",
    service: "web",
    access: "read",
    description:
      "Search the skills.sh marketplace for agent skills.",
  },
];

export const TOOL_METADATA_MAP: Record<string, ToolMetadata> =
  Object.fromEntries(TOOL_METADATA.map((t) => [t.name, t]));
