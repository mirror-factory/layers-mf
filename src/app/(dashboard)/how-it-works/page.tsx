import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  Brain,
  Wrench,
  Network,
  MessageSquare,
  Terminal,
  DollarSign,
  Users,
  Puzzle,
  Plug,
  Layers,
  ArrowDown,
  Zap,
  Clock,
  Shield,
  Globe,
  Database,
  Cpu,
  FileText,
  ChevronRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "How Granger Works",
  description:
    "Understand the architecture behind Granger — system prompts, tools, MCP, context management, sandboxes, and more.",
};

/* ------------------------------------------------------------------ */
/*  Quick Stats                                                        */
/* ------------------------------------------------------------------ */

const QUICK_STATS = [
  { label: "Built-in Tools", value: "25+", icon: Wrench },
  { label: "Tokens / Request", value: "~5-15K", icon: Zap },
  { label: "AI Providers", value: "3", icon: Globe },
  { label: "Model Matrix", value: "9 models", icon: Layers },
  { label: "MCP Servers", value: "Unlimited", icon: Network },
  { label: "Built-in Skills", value: "6", icon: Puzzle },
];

/* ------------------------------------------------------------------ */
/*  System Prompt Diagram                                              */
/* ------------------------------------------------------------------ */

function SystemPromptDiagram() {
  const layers = [
    {
      label: "Base Instructions",
      detail: "~2K tokens — Granger's personality, capabilities, tool documentation",
      color: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
      badge: "~2K tokens",
    },
    {
      label: "Priority Documents",
      detail: "1-10 docs always loaded — team context, OKRs, client briefs",
      color: "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300",
      badge: "1-10 docs",
    },
    {
      label: "User Rules",
      detail: "Hard behavior constraints — e.g. \"Always respond in Spanish\"",
      color: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
      badge: "constraints",
    },
    {
      label: "Current Date / Time",
      detail: "Injected automatically so the model knows \"today\"",
      color: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300",
      badge: "~20 tokens",
    },
    {
      label: "Tool Definitions",
      detail: "~50-150 tokens each — name, description, input schema",
      color: "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300",
      badge: "~3K tokens",
    },
    {
      label: "Conversation History",
      detail: "Pruned — old tool calls stripped after 2 turns",
      color: "bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-300",
      badge: "~5-10K tokens",
    },
    {
      label: "Your Message",
      detail: "The question or instruction you just typed",
      color: "bg-primary/10 border-primary/30 text-primary",
      badge: "variable",
    },
  ];

  return (
    <div className="space-y-1.5">
      {layers.map((layer, idx) => (
        <div key={layer.label}>
          <div
            className={`rounded-lg border p-3 ${layer.color} transition-colors`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{layer.label}</p>
                <p className="text-xs opacity-80 mt-0.5">{layer.detail}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs">
                {layer.badge}
              </Badge>
            </div>
          </div>
          {idx < layers.length - 1 && (
            <div className="flex justify-center py-0.5">
              <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Token Cost Table                                                   */
/* ------------------------------------------------------------------ */

function TokenCostTable() {
  const models = [
    { name: "Gemini Flash Lite", input: "$0.075/M", output: "$0.30/M", tier: "Fast", tierColor: "bg-green-500/10 text-green-700 dark:text-green-300" },
    { name: "Claude Haiku 4.5", input: "$0.80/M", output: "$4/M", tier: "Fast", tierColor: "bg-green-500/10 text-green-700 dark:text-green-300" },
    { name: "GPT-4o Mini", input: "$0.15/M", output: "$0.60/M", tier: "Fast", tierColor: "bg-green-500/10 text-green-700 dark:text-green-300" },
    { name: "Gemini Pro", input: "$1.25/M", output: "$5/M", tier: "Balanced", tierColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    { name: "GPT-4o", input: "$2.50/M", output: "$10/M", tier: "Balanced", tierColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    { name: "Claude Sonnet 4.5", input: "$3/M", output: "$15/M", tier: "Balanced", tierColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    { name: "Claude Opus 4.6", input: "$15/M", output: "$75/M", tier: "Powerful", tierColor: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
    { name: "GPT-4.5", input: "$75/M", output: "$150/M", tier: "Powerful", tierColor: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
    { name: "Gemini Ultra", input: "$5/M", output: "$15/M", tier: "Powerful", tierColor: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 font-medium text-muted-foreground">Model</th>
            <th className="pb-2 font-medium text-muted-foreground">Tier</th>
            <th className="pb-2 font-medium text-muted-foreground">Input</th>
            <th className="pb-2 font-medium text-muted-foreground">Output</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.name} className="border-b last:border-0">
              <td className="py-2 font-medium">{m.name}</td>
              <td className="py-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${m.tierColor}`}>
                  {m.tier}
                </span>
              </td>
              <td className="py-2 font-mono text-xs">{m.input}</td>
              <td className="py-2 font-mono text-xs">{m.output}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sections Data                                                      */
/* ------------------------------------------------------------------ */

type Section = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  content: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "system-prompt",
    icon: Brain,
    title: "System Prompt Architecture",
    content: (
      <div className="space-y-4">
        <p>
          Every message you send to Granger is wrapped in a carefully constructed prompt.
          The model never sees just your message in isolation — it receives a layered context
          stack that determines its personality, knowledge, and capabilities.
        </p>
        <SystemPromptDiagram />
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <p className="font-medium text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Key principles
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground ml-6 list-disc">
            <li>
              <strong>Priority documents ADD context</strong> — they don&apos;t overwrite the base
              instructions. The model sees both and synthesizes them together.
            </li>
            <li>
              <strong>Rules are HARD constraints</strong> — they override other behavior.
              If a rule says &quot;Always respond in Spanish,&quot; the model will comply even if
              the base instructions say to use English.
            </li>
            <li>
              <strong>Order matters</strong> — items earlier in the stack carry more weight.
              Base instructions set the foundation; your message triggers the response.
            </li>
            <li>
              <strong>Total context per request</strong> — typically 5-15K tokens before your
              message, depending on how many tools and priority docs are loaded.
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "tools",
    icon: Wrench,
    title: "How Tools Work",
    content: (
      <div className="space-y-4">
        <p>
          Tools give Granger the ability to take actions — search your context library,
          fetch documents, run code, send emails, and more. Here&apos;s how they work under the hood.
        </p>
        <div className="grid gap-3">
          {[
            {
              icon: FileText,
              title: "Definitions sent with every request",
              detail:
                "Each tool is described by its name, a natural-language description, and a JSON input schema. These definitions are included in every API call so the model knows what tools are available.",
            },
            {
              icon: Brain,
              title: "Model decides when to call",
              detail:
                "During text generation, the model can choose to call a tool instead of producing text. It generates a structured tool call with the required inputs.",
            },
            {
              icon: Shield,
              title: "Only definitions, not code",
              detail:
                "The model never sees the tool's implementation code or internal data. It only knows the name, description, and input schema.",
            },
            {
              icon: Zap,
              title: "Execution and results",
              detail:
                "When a tool is called, Granger executes the corresponding API request server-side. The results are added to the conversation for the model's next turn.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 rounded-lg border p-3">
              <item.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="font-medium text-sm mb-2">Token cost breakdown</p>
          <p className="text-sm text-muted-foreground">
            Each tool definition costs ~50-150 tokens. With 25+ built-in tools, that&apos;s
            approximately <Badge variant="outline">~3K tokens/request</Badge> just for tool
            definitions. This is a fixed cost on every API call, which is why we carefully
            curate which tools are active.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "mcp",
    icon: Network,
    title: "MCP (Model Context Protocol)",
    content: (
      <div className="space-y-4">
        <p>
          MCP is a standard protocol that lets external services expose tools to AI models.
          Instead of building custom integrations for every service, Granger connects to
          MCP servers using a single, universal protocol.
        </p>
        <div className="rounded-lg border p-4 space-y-3">
          <p className="font-medium text-sm">How MCP connection works</p>
          <div className="flex flex-col gap-1.5">
            {[
              "Connect with just a URL — tools are auto-discovered",
              "OAuth flow: auto-discover \u2192 register \u2192 PKCE \u2192 login \u2192 token stored",
              "Tool definitions are fetched and added to your tool set",
              "MCP tools work identically to built-in tools once connected",
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {idx + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="font-medium text-sm mb-1">Example: Granola MCP</p>
          <p className="text-sm text-muted-foreground">
            The Granola MCP server exposes tools like <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">list_meetings</code> and{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">get_meeting_transcript</code>.
            Only the tool definitions are loaded into context (not your meeting data). Actual
            meeting content is fetched on-demand only when the model decides to call the tool.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "context",
    icon: MessageSquare,
    title: "Conversation Context Management",
    content: (
      <div className="space-y-4">
        <p>
          Without context management, conversations would quickly exhaust the model&apos;s context
          window and drive up costs. Granger uses AI SDK v6&apos;s <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">pruneMessages</code> on
          every request to keep things lean.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              label: "Old reasoning",
              action: "Stripped (only keep latest turn)",
              icon: Brain,
            },
            {
              label: "Old tool calls",
              action: "Stripped after 2 turns",
              icon: Wrench,
            },
            {
              label: "Empty messages",
              action: "Removed automatically",
              icon: FileText,
            },
            {
              label: "Conversation history",
              action: "Persisted in DB for reload",
              icon: Database,
            },
          ].map((item) => (
            <div key={item.label} className="flex gap-3 rounded-lg border p-3">
              <item.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.action}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 rounded-lg border bg-muted/50 p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">50K+</p>
            <p className="text-xs text-muted-foreground">Without pruning</p>
            <p className="text-[10px] text-muted-foreground">(20-turn convo)</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">~10K</p>
            <p className="text-xs text-muted-foreground">With pruning</p>
            <p className="text-[10px] text-muted-foreground">(history portion)</p>
          </div>
          <div className="flex-1 text-right">
            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30">
              ~80% savings
            </Badge>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "sandbox",
    icon: Terminal,
    title: "Sandbox & Code Execution",
    content: (
      <div className="space-y-4">
        <p>
          Granger can write and execute code in isolated sandbox environments powered by
          Vercel Sandbox VMs. Each sandbox is secure, ephemeral, and fully containerized.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Languages", value: "JavaScript, TypeScript, Python, HTML" },
            { label: "Templates", value: "React, Vite, Next.js, Python" },
            { label: "Startup (cold)", value: "~15-30 seconds" },
            { label: "Startup (snapshot)", value: "~2 seconds" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-medium text-sm mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[
            {
              icon: Cpu,
              title: "Isolated VMs",
              detail: "Each sandbox runs in its own Vercel VM — fully isolated, secure, and ephemeral. No access to your main system.",
            },
            {
              icon: Layers,
              title: "Smart snapshots",
              detail: "After each run, the entire VM state is saved (files + node_modules). Subsequent runs restore from the snapshot for ~2 second startup.",
            },
            {
              icon: Globe,
              title: "Preview URLs",
              detail: "Web apps get a temporary preview URL (~2 min idle timeout). The \"Restart\" button restores from the latest snapshot.",
            },
            {
              icon: Zap,
              title: "Auto-install",
              detail: "Python sandboxes auto-detect imports and pip install missing packages. JS/TS templates include boilerplate for immediate development.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 rounded-lg border p-3">
              <item.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="font-medium text-sm mb-1">Sandbox costs</p>
          <p className="text-sm text-muted-foreground">
            <Badge variant="outline" className="mr-1">$0.13/vCPU-hr</Badge>
            <Badge variant="outline">$0.085/GB-hr memory</Badge>
            <span className="ml-2">— CPU time, memory, and network egress are logged per execution.</span>
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "gateway",
    icon: DollarSign,
    title: "AI Gateway & Cost Tracking",
    content: (
      <div className="space-y-4">
        <p>
          All AI calls in Granger are routed through the Vercel AI Gateway — a single API
          key that provides access to multiple providers. This gives you unified cost tracking,
          model fallbacks, and provider-agnostic code.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { provider: "Anthropic", models: "Claude Haiku, Sonnet, Opus", color: "border-violet-500/30 bg-violet-500/5" },
            { provider: "OpenAI", models: "GPT-4o Mini, GPT-4o, GPT-4.5", color: "border-green-500/30 bg-green-500/5" },
            { provider: "Google", models: "Gemini Flash, Pro, Ultra", color: "border-blue-500/30 bg-blue-500/5" },
          ].map((p) => (
            <div key={p.provider} className={`rounded-lg border p-3 ${p.color}`}>
              <p className="font-medium text-sm">{p.provider}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{p.models}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="font-medium text-sm mb-3">Model pricing (per million tokens)</p>
          <TokenCostTable />
        </div>
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="font-medium text-sm mb-1">Per-request tracking</p>
          <p className="text-sm text-muted-foreground">
            Every API call is tagged with user ID, model, and custom tags for cost attribution.
            View breakdowns on the <strong>AI Costs</strong> dashboard — by user, model, time
            period, and operation type.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "organization",
    icon: Users,
    title: "Organization & Sharing",
    content: (
      <div className="space-y-4">
        <p>
          Everything in Granger is scoped to an organization. When you create an org, you
          become its owner and can invite team members to collaborate.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              role: "Owner",
              desc: "Full control — billing, members, settings, data",
              color: "border-amber-500/30 bg-amber-500/5",
            },
            {
              role: "Admin",
              desc: "Manage members, settings, integrations",
              color: "border-blue-500/30 bg-blue-500/5",
            },
            {
              role: "Member",
              desc: "Use all tools, chat, context, skills",
              color: "border-green-500/30 bg-green-500/5",
            },
          ].map((r) => (
            <div key={r.role} className={`rounded-lg border p-3 ${r.color}`}>
              <p className="font-medium text-sm">{r.role}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-1.5 text-sm text-muted-foreground ml-6 list-disc">
          <li>All data is org-scoped via <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">org_id</code> — context items, conversations, skills, rules</li>
          <li>Conversations can be shared with view or edit access levels</li>
          <li>Context items are org-wide by default</li>
          <li>Skills you create are available to all org members</li>
        </ul>
      </div>
    ),
  },
  {
    id: "skills",
    icon: Puzzle,
    title: "Skills & Extensions",
    content: (
      <div className="space-y-4">
        <p>
          Skills are pre-packaged bundles of system prompts, tools, and reference files that
          give Granger specialized capabilities for specific workflows.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Built-in skills", value: "6 — PM, Email, Meeting, Code, Weekly, Brand" },
            { label: "Marketplace", value: "skills.sh — 2000+ community skills" },
            { label: "Custom skills", value: "AI interview, manual form, or sandbox code" },
            { label: "Activation", value: "Slash command or toggle in chat" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-medium text-sm mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="font-medium text-sm mb-1">What&apos;s inside a skill?</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground ml-6 list-disc">
            <li><strong>System prompt</strong> — added to context when skill is active</li>
            <li><strong>Tools</strong> — additional tool definitions loaded on activation</li>
            <li><strong>Reference files</strong> — loaded into context as background knowledge</li>
            <li><strong>Slash command</strong> — e.g. <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">/pm</code> to activate the PM skill</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "integrations",
    icon: Plug,
    title: "Integrations",
    content: (
      <div className="space-y-4">
        <p>
          Granger connects to external services through three distinct integration layers,
          each suited for different use cases.
        </p>
        <div className="space-y-3">
          {[
            {
              icon: Database,
              title: "MCP — Context Sync",
              detail:
                "MCP server integrations for Google Drive, GitHub, Slack, and more. Syncs content to your Context Library as searchable context items. Content is indexed, chunked, and embedded for hybrid search.",
              badge: "Context",
            },
            {
              icon: Network,
              title: "MCP — Direct Tool Access",
              detail:
                "Model Context Protocol for real-time tool access. Connect to Granola for meeting notes, Linear for project management, and any MCP-compatible service. Data is fetched on-demand.",
              badge: "Tools",
            },
            {
              icon: MessageSquare,
              title: "Chat SDK — Webhook Endpoints",
              detail:
                "Expose Granger as a bot on Discord, Slack, or custom platforms via webhook endpoint. Full chat experience with slash commands and tool access.",
              badge: "Chat",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 rounded-lg border p-4">
              <item.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{item.title}</p>
                  <Badge variant="outline" className="text-xs">{item.badge}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HowItWorksPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">How Granger Works</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          A deep dive into the architecture behind Granger — system prompts, tools, MCP,
          context management, sandboxes, cost tracking, and more.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_STATS.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-3 text-center">
              <Icon className="h-4 w-4 text-primary mx-auto mb-1.5" />
              <p className="text-lg font-bold">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sections */}
      <Card>
        <CardContent className="p-0">
          <Accordion type="multiple" defaultValue={["system-prompt"]} className="px-5">
            {SECTIONS.map(({ id, icon: Icon, title, content }) => (
              <AccordionItem key={id} value={id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span>{title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="text-sm leading-relaxed pl-7">{content}</div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="rounded-lg border bg-muted/50 p-5 text-center">
        <p className="text-sm text-muted-foreground">
          Want to see it in action? Open <strong>Chat</strong> and ask Granger to explain
          how any of these systems work — it can inspect its own architecture in real time.
        </p>
      </div>
    </div>
  );
}
