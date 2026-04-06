import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Static built-in tool registry                                      */
/* ------------------------------------------------------------------ */

type ToolCategory =
  | "Knowledge"
  | "Agents"
  | "Code/Sandbox"
  | "Documents"
  | "Scheduling"
  | "Web"
  | "Skills"
  | "Compliance"
  | "Artifacts";

interface BuiltInTool {
  name: string;
  category: ToolCategory;
  description: string;
  inputSchema: Record<string, unknown>;
  hasExecute: boolean;
  status: "active" | "beta" | "deprecated";
}

const BUILT_IN_TOOLS: BuiltInTool[] = [
  {
    name: "search_context",
    category: "Knowledge",
    description: "Search knowledge base for documents, meetings, notes. Call first before answering.",
    inputSchema: {
      query: { type: "string", required: true, description: "The search query" },
      limit: { type: "number", required: false, description: "Maximum results (1-20)" },
      "filters.sourceType": { type: "string", required: false, description: "Filter by source type" },
      "filters.contentType": { type: "string", required: false, description: "Filter by content type" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "get_document",
    category: "Knowledge",
    description: "Fetch full document content by ID. Use when search result needs deeper reading.",
    inputSchema: {
      id: { type: "string", required: true, description: "The document ID from search_context results" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "ingest_github_repo",
    category: "Knowledge",
    description: "Import a GitHub repo into the context library. Clones, reads key files, saves as searchable context.",
    inputSchema: {
      repo: { type: "string", required: true, description: "GitHub repo in owner/repo format" },
      branch: { type: "string", required: false, description: "Branch to clone, defaults to main" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "ai_sdk_reference",
    category: "Knowledge",
    description: "Look up Vercel AI SDK and AI Elements patterns for building AI-powered apps.",
    inputSchema: {
      topic: { type: "enum", required: true, description: "AI SDK topic", values: ["chat-client", "chat-server", "generate-text", "generate-object", "tools", "streaming", "sandbox-ai-app", "embeddings", "gateway"] },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "list_linear_issues",
    category: "Agents",
    description: "Query Linear issues with filters. For tasks, status checks, assignments.",
    inputSchema: {
      state: { type: "string", required: false, description: "Filter by state" },
      assignee: { type: "string", required: false, description: "Filter by assignee name or 'me'" },
      team: { type: "string", required: false, description: "Filter by team key" },
      priority: { type: "number", required: false, description: "1=Urgent, 2=High, 3=Medium, 4=Low" },
      limit: { type: "number", required: false, description: "Max results, default 20" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "create_linear_issue",
    category: "Agents",
    description: "Create Linear issue. Routes through approval queue.",
    inputSchema: {
      title: { type: "string", required: true },
      team: { type: "string", required: true, description: "Team key" },
      description: { type: "string", required: false },
      priority: { type: "number", required: false },
      assignee: { type: "string", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "query_granola",
    category: "Agents",
    description: "Search Granola meeting notes and transcripts.",
    inputSchema: {
      since: { type: "string", required: false, description: "ISO date to search from" },
      limit: { type: "number", required: false, description: "Max meetings, default 10" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "search_gmail",
    category: "Agents",
    description: "Search Gmail. Syntax: from:, subject:, newer_than:, is:unread.",
    inputSchema: {
      query: { type: "string", required: true, description: "Gmail search query" },
      limit: { type: "number", required: false, description: "Max results, default 10" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "draft_email",
    category: "Agents",
    description: "Draft Gmail email. Routes through approval queue.",
    inputSchema: {
      to: { type: "string", required: true },
      subject: { type: "string", required: true },
      body: { type: "string", required: true },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "search_notion",
    category: "Agents",
    description: "Search Notion pages and databases.",
    inputSchema: {
      query: { type: "string", required: false, description: "Search query text" },
      limit: { type: "number", required: false, description: "Max results, default 10" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "list_drive_files",
    category: "Agents",
    description: "List and search Google Drive files.",
    inputSchema: {
      query: { type: "string", required: false, description: "Search query for file names" },
      limit: { type: "number", required: false, description: "Max results, default 20" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "ask_linear_agent",
    category: "Agents",
    description: "Delegate to Linear specialist. Use for ALL task/issue requests.",
    inputSchema: {
      query: { type: "string", required: true, description: "The full user request about Linear" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "ask_gmail_agent",
    category: "Agents",
    description: "Delegate to the Gmail specialist agent for email-related requests.",
    inputSchema: {
      query: { type: "string", required: true, description: "The full user request about emails" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "ask_notion_agent",
    category: "Agents",
    description: "Delegate to the Notion specialist agent for page/database queries.",
    inputSchema: {
      query: { type: "string", required: true, description: "The full user request about Notion" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "ask_granola_agent",
    category: "Agents",
    description: "Delegate to the Granola specialist agent for meeting transcript queries.",
    inputSchema: {
      query: { type: "string", required: true, description: "The full user request about meetings" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "ask_drive_agent",
    category: "Agents",
    description: "Delegate to the Drive specialist agent for file search and reading.",
    inputSchema: {
      query: { type: "string", required: true, description: "The full user request about Drive files" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "ask_user",
    category: "Agents",
    description: "Ask the user structured questions via interactive form. Client-side tool.",
    inputSchema: {
      title: { type: "string", required: true, description: "Heading for the question panel" },
      description: { type: "string", required: false },
      questions: { type: "array", required: true, description: "Array of question objects with id, label, type, options" },
    },
    hasExecute: false,
    status: "active",
  },
  {
    name: "schedule_action",
    category: "Scheduling",
    description: "Schedule a recurring or one-time action.",
    inputSchema: {
      name: { type: "string", required: true },
      description: { type: "string", required: false },
      action_type: { type: "enum", required: true, values: ["query", "sync", "digest", "custom"] },
      target_service: { type: "string", required: false },
      payload: { type: "object", required: true },
      schedule: { type: "string", required: true, description: "Cron expression or once:ISO_DATE" },
      max_runs: { type: "number", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "list_schedules",
    category: "Scheduling",
    description: "List scheduled actions.",
    inputSchema: {
      status: { type: "enum", required: false, values: ["active", "paused", "completed", "all"] },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "edit_schedule",
    category: "Scheduling",
    description: "Edit schedule: change name, timing, status (pause/resume).",
    inputSchema: {
      id: { type: "string", required: true },
      name: { type: "string", required: false },
      description: { type: "string", required: false },
      schedule: { type: "string", required: false },
      status: { type: "enum", required: false, values: ["active", "paused"] },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "delete_schedule",
    category: "Scheduling",
    description: "Delete a scheduled action permanently.",
    inputSchema: {
      id: { type: "string", required: true },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "run_project",
    category: "Code/Sandbox",
    description: "Create and run a multi-file project in a sandboxed VM.",
    inputSchema: {
      template: { type: "enum", required: false, values: ["none", "react", "nextjs", "vite", "python"] },
      files: { type: "array", required: true, description: "Array of { path, content }" },
      add_files: { type: "array", required: false },
      install_command: { type: "string", required: false },
      run_command: { type: "string", required: true },
      read_output_files: { type: "array", required: false },
      expose_port: { type: "number", required: false, description: "Default 5173" },
      description: { type: "string", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "run_code",
    category: "Code/Sandbox",
    description: "Execute a script in a sandboxed VM. For computations, data processing, API testing.",
    inputSchema: {
      code: { type: "string", required: true },
      language: { type: "enum", required: true, values: ["javascript", "typescript", "python"] },
      filename: { type: "string", required: false },
      packages: { type: "array", required: false },
      description: { type: "string", required: false },
      expose_port: { type: "number", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "web_browse",
    category: "Web",
    description: "Fetch a URL and extract text content. Use to read web pages, docs, articles.",
    inputSchema: {
      url: { type: "string", required: true, description: "Full URL to fetch" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "web_search",
    category: "Web",
    description: "Search the web for current information via Perplexity Sonar. Returns results with source citations.",
    inputSchema: {
      query: { type: "string", required: true, description: "The search query" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "review_compliance",
    category: "Compliance",
    description: "Review content against org rules and priority documents.",
    inputSchema: {
      content: { type: "string", required: true, description: "The content to review" },
      content_label: { type: "string", required: false, description: "What this content is" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "list_approvals",
    category: "Compliance",
    description: "List pending approvals.",
    inputSchema: {
      status: { type: "enum", required: false, values: ["pending", "approved", "rejected", "all"] },
      limit: { type: "number", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "propose_action",
    category: "Compliance",
    description: "Propose write action to external services for approval.",
    inputSchema: {
      action_type: { type: "enum", required: true, values: ["create_task", "send_message", "draft_email", "update_task", "send_slack", "update_issue"] },
      target_service: { type: "enum", required: true, values: ["linear", "slack", "gmail", "discord", "notion"] },
      payload: { type: "object", required: true },
      reasoning: { type: "string", required: true },
      conflict_check: { type: "string", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "artifact_list",
    category: "Artifacts",
    description: "List artifacts. Filter by type, search by title.",
    inputSchema: {
      type: { type: "enum", required: false, values: ["code", "document", "sandbox"] },
      search: { type: "string", required: false },
      limit: { type: "number", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "artifact_get",
    category: "Artifacts",
    description: "Get artifact content and open it in the artifact viewer.",
    inputSchema: {
      artifactId: { type: "string", required: true },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "artifact_version",
    category: "Artifacts",
    description: "List or restore artifact versions.",
    inputSchema: {
      artifactId: { type: "string", required: true },
      action: { type: "enum", required: true, values: ["list", "restore"] },
      versionNumber: { type: "number", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "artifact_panel",
    category: "Artifacts",
    description: "Open or close the artifact side panel. Client-side tool.",
    inputSchema: {
      action: { type: "enum", required: true, values: ["open", "close"] },
      artifactId: { type: "string", required: false },
    },
    hasExecute: false,
    status: "active",
  },
  {
    name: "artifact_delete",
    category: "Artifacts",
    description: "Delete an artifact.",
    inputSchema: {
      artifactId: { type: "string", required: true },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "write_code",
    category: "Artifacts",
    description: "Save a code file as an artifact with version history.",
    inputSchema: {
      filename: { type: "string", required: true },
      language: { type: "string", required: true },
      code: { type: "string", required: true },
      description: { type: "string", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "edit_code",
    category: "Artifacts",
    description: "Edit an existing code artifact using find/replace, creating a new version.",
    inputSchema: {
      artifactId: { type: "string", required: true },
      targetText: { type: "string", required: true },
      replacement: { type: "string", required: true },
      editDescription: { type: "string", required: false },
      filePath: { type: "string", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "express",
    category: "Artifacts",
    description: "Generate animated dot pattern inline in chat.",
    inputSchema: {
      concept: { type: "string", required: true, description: "What to express" },
      size: { type: "number", required: false },
      dotCount: { type: "number", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "create_document",
    category: "Documents",
    description: "Create a new rich-text document artifact.",
    inputSchema: {
      title: { type: "string", required: true },
      content: { type: "string", required: true, description: "HTML content" },
      description: { type: "string", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "edit_document",
    category: "Documents",
    description: "Edit an existing document or artifact.",
    inputSchema: {
      documentId: { type: "string", required: true },
      newTitle: { type: "string", required: false },
      targetText: { type: "string", required: false },
      replacement: { type: "string", required: false },
      editDescription: { type: "string", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "activate_skill",
    category: "Skills",
    description: "Activate a skill to load its specialized instructions and tools.",
    inputSchema: {
      skill_slug: { type: "string", required: true, description: "The slug of the skill to activate" },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "create_skill",
    category: "Skills",
    description: "Create a new custom skill for the agent.",
    inputSchema: {
      name: { type: "string", required: true },
      slug: { type: "string", required: true },
      description: { type: "string", required: true },
      category: { type: "enum", required: true, values: ["productivity", "analysis", "creative", "development", "communication", "general"] },
      system_prompt: { type: "string", required: true },
      icon: { type: "string", required: false },
      slash_command: { type: "string", required: false },
      tools: { type: "array", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "create_tool_from_code",
    category: "Skills",
    description: "Create a custom tool by generating and testing code in a sandbox.",
    inputSchema: {
      name: { type: "string", required: true },
      description: { type: "string", required: true },
      code: { type: "string", required: true },
      test_input: { type: "string", required: true },
      language: { type: "enum", required: false, values: ["javascript", "python"] },
      packages: { type: "array", required: false },
    },
    hasExecute: true,
    status: "active",
  },
  {
    name: "search_skills_marketplace",
    category: "Skills",
    description: "Search the skills.sh marketplace for agent skills.",
    inputSchema: {
      query: { type: "string", required: true },
      limit: { type: "number", required: false },
    },
    hasExecute: true,
    status: "active",
  },
];

/* ------------------------------------------------------------------ */
/*  GET /api/tools/registry                                            */
/* ------------------------------------------------------------------ */

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve org
  const { createAdminClient } = await import("@/lib/supabase/server");
  const adminDb = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (adminDb as any)
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  const orgId = member?.org_id as string | undefined;

  // Fetch MCP servers
  let mcpServers: { serverName: string; tools: string[] }[] = [];
  if (orgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: servers } = await (adminDb as any)
      .from("mcp_servers")
      .select("name, discovered_tools")
      .eq("org_id", orgId)
      .eq("status", "connected");

    mcpServers = (servers ?? []).map(
      (s: { name: string; discovered_tools: string[] | null }) => ({
        serverName: s.name,
        tools: s.discovered_tools ?? [],
      }),
    );
  }

  // Fetch skills
  let skills: { name: string; slug: string; tools: string[] }[] = [];
  if (orgId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: skillRows } = await (adminDb as any)
      .from("skills")
      .select("name, slug, tools, is_active")
      .eq("org_id", orgId)
      .eq("is_active", true);

    skills = (skillRows ?? []).map(
      (s: {
        name: string;
        slug: string;
        tools: { name: string }[] | null;
      }) => ({
        name: s.name,
        slug: s.slug,
        tools: (s.tools ?? []).map((t) => t.name),
      }),
    );
  }

  return NextResponse.json({
    builtIn: BUILT_IN_TOOLS,
    mcp: mcpServers,
    skills,
  });
}
