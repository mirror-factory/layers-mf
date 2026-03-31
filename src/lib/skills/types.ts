export interface ReferenceFile {
  name: string;
  content: string;
  type: "text" | "markdown" | "code";
}

export interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  category: SkillCategory;
  icon: string;
  systemPrompt?: string;
  tools?: SkillToolDef[];
  config?: Record<string, unknown>;
  referenceFiles?: ReferenceFile[];
  slashCommand?: string;
  isActive: boolean;
  isBuiltin: boolean;
}

export type SkillCategory =
  | "productivity"
  | "analysis"
  | "creative"
  | "development"
  | "communication"
  | "general";

export interface SkillToolDef {
  name: string;
  description: string;
}

export const SKILL_CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: "productivity", label: "Productivity" },
  { value: "analysis", label: "Analysis" },
  { value: "creative", label: "Creative" },
  { value: "development", label: "Development" },
  { value: "communication", label: "Communication" },
  { value: "general", label: "General" },
];

export const BUILTIN_SKILLS: Omit<Skill, "id">[] = [
  {
    slug: "linear-pm",
    name: "Linear Project Manager",
    description:
      "Sprint planning, issue management, and task tracking via Linear",
    version: "1.0.0",
    author: "Granger",
    category: "productivity",
    icon: "📋",
    systemPrompt:
      "You are a project management specialist. Focus on sprint planning, issue tracking, and team coordination. Use Linear tools to query and manage issues. Format results as tables. Suggest next actions.",
    tools: [
      {
        name: "ask_linear_agent",
        description: "Delegate to Linear specialist",
      },
    ],
    slashCommand: "/pm",
    isActive: true,
    isBuiltin: true,
  },
  {
    slug: "email-drafter",
    name: "Email Drafter",
    description:
      "Compose professional emails with context from meetings and docs",
    version: "1.0.0",
    author: "Granger",
    category: "communication",
    icon: "✉️",
    systemPrompt:
      "You are an email drafting specialist. Search context for relevant information, then draft clear, professional emails. Always ask for approval before saving drafts.",
    tools: [
      { name: "ask_gmail_agent", description: "Delegate to Gmail specialist" },
    ],
    slashCommand: "/email",
    isActive: true,
    isBuiltin: true,
  },
  {
    slug: "meeting-summarizer",
    name: "Meeting Summarizer",
    description:
      "Extract decisions, action items, and key points from meeting transcripts",
    version: "1.0.0",
    author: "Granger",
    category: "productivity",
    icon: "🎙️",
    systemPrompt:
      "You are a meeting analysis specialist. When given a transcript or asked about meetings, extract: decisions made, action items (with owners and deadlines), key discussion points, and follow-up items. Format clearly with sections.",
    tools: [
      {
        name: "ask_granola_agent",
        description: "Delegate to Granola specialist",
      },
      { name: "search_context", description: "Search knowledge base" },
    ],
    slashCommand: "/meeting",
    isActive: true,
    isBuiltin: true,
  },
  {
    slug: "code-builder",
    name: "Code Builder",
    description: "Generate, execute, and preview code artifacts and tools",
    version: "1.0.0",
    author: "Granger",
    category: "development",
    icon: "💻",
    systemPrompt:
      "You are a code generation specialist. Write clean, well-commented code. For HTML/CSS: use write_code with preview. For scripts that need execution: use run_code. Always explain what the code does.",
    tools: [
      { name: "write_code", description: "Create code artifact" },
      { name: "run_code", description: "Execute in sandbox" },
    ],
    slashCommand: "/code",
    isActive: true,
    isBuiltin: true,
  },
  {
    slug: "weekly-digest",
    name: "Weekly Digest",
    description:
      "Generate a comprehensive weekly summary across all sources",
    version: "1.0.0",
    author: "Granger",
    category: "productivity",
    icon: "📊",
    systemPrompt:
      "You are a weekly reporting specialist. Search across all context sources to compile a comprehensive weekly summary including: completed tasks, open items, key decisions, upcoming deadlines, and recommended priorities for next week.",
    tools: [
      { name: "search_context", description: "Search knowledge base" },
      { name: "ask_linear_agent", description: "Check Linear issues" },
    ],
    slashCommand: "/weekly",
    isActive: true,
    isBuiltin: true,
  },
  {
    slug: "brand-voice",
    name: "Brand Voice Writer",
    description:
      "Write content matching Mirror Factory brand tone and values",
    version: "1.0.0",
    author: "Granger",
    category: "creative",
    icon: "🎨",
    systemPrompt:
      "You are a brand content specialist for Mirror Factory. Write in a direct, technical, no-BS tone. Reference company values from priority docs. Content should be clear, concise, and professional without being corporate.",
    tools: [
      { name: "search_context", description: "Search for brand guidelines" },
      { name: "write_code", description: "Create content artifacts" },
    ],
    slashCommand: "/brand",
    isActive: true,
    isBuiltin: true,
  },
];
