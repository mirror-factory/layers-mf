"use client";

import { useState } from "react";
import { NeuralDots } from "@/components/ui/neural-dots";
import { NeuralMorph } from "@/components/ui/neural-morph";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  Code,
  FileText,
  Zap,
  Globe,
  Calendar,
  Users,
  Shield,
  Search,
  Play,
  CheckCircle2,
  ArrowRight,
  Layers,
  Bot,
  Cpu,
  Database,
  Link2,
  Clock,
  Share2,
  CircleDot,
  Workflow,
  Mail,
  BookOpen,
  Terminal,
  Eye,
  UserPlus,
  Lock,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>}
    </div>
  );
}

function StatusDot({ status }: { status: "green" | "yellow" | "gray" }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0",
        status === "green" && "bg-emerald-400",
        status === "yellow" && "bg-yellow-400",
        status === "gray" && "bg-zinc-500",
      )}
    />
  );
}

function ToolCard({
  icon: Icon,
  name,
  description,
  active = true,
}: {
  icon: React.ElementType;
  name: string;
  description: string;
  active?: boolean;
}) {
  return (
    <Card className="border-border/60 bg-card/50 hover:border-primary/30 transition-colors">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{name}</span>
          </div>
          {active && <StatusDot status="green" />}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function ConnectorBadge({
  name,
  connected = false,
}: {
  name: string;
  connected?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
      <span className="text-sm text-foreground">{name}</span>
      {connected ? (
        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary gap-1">
          <StatusDot status="green" /> Connected
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
          Available
        </Badge>
      )}
    </div>
  );
}

function TimelineStep({ label, description, last = false }: { label: string; description: string; last?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full border-2 border-primary bg-primary/20 shrink-0" />
        {!last && <div className="w-px flex-1 bg-primary/20 mt-1" />}
      </div>
      <div className="pb-6">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export function OverviewPage() {
  const [heroFormation] = useState<"galaxy">("galaxy");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 space-y-24">
      {/* ============================================================ */}
      {/*  Section 1 — Hero                                            */}
      {/* ============================================================ */}
      <section className="flex flex-col items-center text-center gap-6">
        <NeuralMorph size={120} dotCount={18} formation={heroFormation} />
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
            Layers
          </h1>
          <p className="mt-2 text-lg text-primary font-medium">AI OS for Knowledge Teams</p>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground leading-relaxed mx-auto">
            An agentic AI platform that ingests knowledge, runs multi-step tasks, generates
            artifacts, and manages context across your organization. One interface to think,
            build, and ship with AI.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Section 2 — The Stack                                       */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title="The Stack"
          subtitle="Three layers that power every AI interaction in Layers."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            {
              icon: Cpu,
              name: "Vercel AI SDK v6",
              desc: "Agentic chat, tool loops, streaming, structured output",
            },
            {
              icon: Layers,
              name: "AI Gateway",
              desc: "Single API key for 9 models across 3 providers",
            },
            {
              icon: Bot,
              name: "AI Elements",
              desc: "Pre-built UI components for messages, tools, artifacts",
            },
          ].map((s) => (
            <Card key={s.name} className="border-border/60 bg-card/50">
              <CardContent className="p-5 flex flex-col gap-2">
                <s.icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-foreground">{s.name}</span>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Flow diagram */}
        <div className="flex items-center justify-center gap-3 flex-wrap text-xs text-muted-foreground">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span>User</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-primary/50" />
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            <span>Chat UI</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-primary/50" />
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-primary font-medium">AI Gateway</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-primary/50" />
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
            <Database className="h-3.5 w-3.5 text-primary" />
            <span>9 Models / 3 Providers</span>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Section 3 — Chat System                                     */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title="Chat System"
          subtitle="Agentic conversations powered by ToolLoopAgent with 9 model options, inline HTML visuals, and emotional awareness."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Every conversation is an agent loop. The AI can call tools, inspect results,
              and decide its next step autonomously. It searches your knowledge base, writes
              and runs code, creates documents, and manages project issues — all in one thread.
            </p>
            <p>
              Models are swappable mid-conversation. Switch from Claude Haiku for quick
              answers to Claude Opus for deep analysis. The AI Gateway routes to
              Anthropic, OpenAI, or Google seamlessly.
            </p>
            <ul className="space-y-2 mt-4">
              {[
                "ToolLoopAgent with automatic multi-step reasoning",
                "9 models across Anthropic, OpenAI, Google",
                "Inline HTML visuals in responses",
                "Streaming with real-time tool call status",
                "Context window visualization and token counting",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mini chat simulation */}
          <Card className="border-border/60 bg-card/50 overflow-hidden">
            <CardContent className="p-0">
              {/* User message */}
              <div className="border-b border-border/40 p-4 flex gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[11px] font-medium text-primary">
                  A
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  What were the key decisions from yesterday&apos;s meeting?
                </p>
              </div>
              {/* Tool call */}
              <div className="border-b border-border/40 px-4 py-2.5 flex items-center gap-2">
                <NeuralDots size={18} dotCount={4} />
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> search_context
                </Badge>
                <span className="text-[10px] text-muted-foreground">3 results</span>
              </div>
              {/* Assistant response */}
              <div className="p-4 flex gap-3">
                <div className="shrink-0 mt-0.5">
                  <NeuralDots size={28} dotCount={5} />
                </div>
                <div className="text-sm text-foreground leading-relaxed space-y-2">
                  <p>
                    Based on the meeting notes from April 5, three key decisions were made:
                  </p>
                  <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
                    <li>Prioritize connector overhaul for Q2</li>
                    <li>Move scheduling to background jobs architecture</li>
                    <li>Ship sharing for conversations this week</li>
                  </ol>
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <BookOpen className="h-2.5 w-2.5" />
                    Source: Meeting Notes — April 5 Standup
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Section 4 — Artifacts & Sandbox                             */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title="Artifacts & Sandbox"
          subtitle="Code, documents, and live previews — all versioned, all sandboxed."
        />
        <Tabs defaultValue="code" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="code" className="gap-1.5">
              <Code className="h-3.5 w-3.5" /> Code
            </TabsTrigger>
            <TabsTrigger value="document" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Document
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Live Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code">
            <Card className="border-border/60 bg-card/50">
              <CardContent className="p-4">
                <pre className="text-xs text-muted-foreground font-mono leading-relaxed overflow-x-auto">
                  <code>{`export function Dashboard() {
  const { data } = useQuery("analytics");
  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricCard title="Active Users" value={data.users} />
      <MetricCard title="Conversations" value={data.chats} />
      <MetricCard title="Artifacts" value={data.artifacts} />
    </div>
  );
}`}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="document">
            <Card className="border-border/60 bg-card/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-2 border-b border-border/40 pb-3">
                  {["Bold", "Italic", "Heading", "List", "Link"].map((btn) => (
                    <span
                      key={btn}
                      className="text-[10px] text-muted-foreground border border-border/60 rounded px-2 py-0.5"
                    >
                      {btn}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-foreground">
                  TipTap rich text editor with AI-assisted writing. Supports headings,
                  lists, code blocks, images, and tables. Full formatting toolbar with
                  keyboard shortcuts.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card className="border-border/60 bg-card/50">
              <CardContent className="p-4">
                <div className="rounded-lg border border-border/40 bg-background/50 h-48 flex flex-col items-center justify-center gap-3">
                  <Play className="h-8 w-8 text-primary/40" />
                  <p className="text-sm text-muted-foreground">Live sandbox preview</p>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 gap-1">
                    <StatusDot status="green" /> Running
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="mt-4 text-xs text-muted-foreground leading-relaxed max-w-2xl">
          Every artifact has version history, a file tree, and per-sandbox controls
          (start, stop, restart). Code artifacts run in isolated E2B sandboxes with
          real package installation and port detection.
        </p>
      </section>

      {/* ============================================================ */}
      {/*  Section 5 — Tools & Capabilities                            */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title="Tools & Capabilities"
          subtitle="The agent's toolkit — each tool is a capability the AI can invoke autonomously during conversations."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ToolCard icon={Search} name="search_context" description="Search your knowledge base with hybrid vector + BM25 ranking" />
          <ToolCard icon={Globe} name="web_search" description="Search the web via Perplexity for real-time information" />
          <ToolCard icon={Terminal} name="write_code / run_project" description="Generate and run code in isolated sandboxes" />
          <ToolCard icon={FileText} name="create_document" description="Create rich documents with formatting and structure" />
          <ToolCard icon={UserPlus} name="ask_user" description="Interview users with structured forms for requirements gathering" />
          <ToolCard icon={Calendar} name="schedule_action" description="Schedule recurring tasks that run on a cron" />
          <ToolCard icon={Workflow} name="ask_linear_agent" description="Create, update, and manage Linear issues and projects" />
          <ToolCard icon={Mail} name="ask_gmail_agent" description="Search emails and draft responses via Gmail" />
          <ToolCard icon={Shield} name="review_compliance" description="Check content against organizational rules and policies" />
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Section 6 — Scheduling Vision                               */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title="Scheduling"
          subtitle="Background chats that run on a schedule, generate artifacts, and send notifications."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
            <p>
              Schedules are background conversations triggered by cron expressions.
              Each run starts a fresh agent loop with a defined prompt, letting the AI
              search context, call APIs, generate dashboards, and deliver results
              without human intervention.
            </p>
            <p>
              Combine with sandbox artifacts to auto-generate daily dashboards,
              weekly reports, or monitoring pages that update themselves.
            </p>
          </div>
          <div>
            <TimelineStep
              label='Schedule: "Every day 9am"'
              description="Cron trigger fires and starts a background chat"
            />
            <TimelineStep
              label="AI runs prompt"
              description="Looks up news, weather, calendar, and team updates"
            />
            <TimelineStep
              label="Generates sandbox dashboard"
              description="Writes React code, installs deps, launches preview"
            />
            <TimelineStep
              label="Sends notification with link"
              description="Desktop push notification delivered to the user"
              last
            />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Section 7 — Connectors & MCP                                */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title="Connectors & MCP"
          subtitle="Ingest knowledge from every tool your team uses. Extend with MCP servers for any API."
        />
        <div className="flex flex-wrap gap-2 mb-6">
          <ConnectorBadge name="Google Drive" connected />
          <ConnectorBadge name="GitHub" connected />
          <ConnectorBadge name="Slack" connected />
          <ConnectorBadge name="Linear" connected />
          <ConnectorBadge name="Gmail" connected />
          <ConnectorBadge name="Notion" />
          <ConnectorBadge name="Granola" connected />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
          MCP (Model Context Protocol) servers let you extend Layers with any API.
          Connect to internal tools, databases, or third-party services. Each server
          registers tools that the AI can call during conversations, with PKCE OAuth
          for secure authentication.
        </p>
      </section>

      {/* ============================================================ */}
      {/*  Section 8 — Sharing & Organizations                         */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title="Sharing & Organizations"
          subtitle="Share conversations, artifacts, and knowledge across your team."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sharing model diagram */}
          <div className="space-y-4">
            {[
              {
                icon: Users,
                label: "Organization",
                desc: "All members see all content within the org",
                active: true,
              },
              {
                icon: Link2,
                label: "Share Links",
                desc: "Public URLs — anyone with the link can view",
                active: true,
              },
              {
                icon: Lock,
                label: "Per-resource Permissions",
                desc: "Fine-grained access control per item",
                active: false,
              },
              {
                icon: ExternalLink,
                label: "Guest Access",
                desc: "Invite external collaborators with limited scope",
                active: false,
              },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3",
                  item.active
                    ? "border-border/60 bg-card/50"
                    : "border-border/30 bg-card/20 opacity-60",
                )}
              >
                <item.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    {!item.active && (
                      <Badge variant="outline" className="text-[9px] text-muted-foreground">
                        Planned
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Simulated share dialog */}
          <Card className="border-border/60 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" />
                Share Conversation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-border/60 bg-background/50 px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground truncate">
                  layers.app/share/c/abc123
                </span>
                <Badge variant="outline" className="text-[9px] text-primary shrink-0 ml-2">
                  Copy
                </Badge>
              </div>
              <div className="space-y-2">
                {["Anyone with the link can view", "Organization members only", "Private (only you)"].map(
                  (opt, i) => (
                    <label key={opt} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full border",
                          i === 0
                            ? "border-primary bg-primary"
                            : "border-border",
                        )}
                      />
                      {opt}
                    </label>
                  ),
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Section 9 — Multi-User Chat Vision                          */}
      {/* ============================================================ */}
      <section>
        <div className="mb-8 flex items-center gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Multi-User Chat
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Real-time collaborative conversations where team members and AI work together.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/60 shrink-0">
            Coming Soon
          </Badge>
        </div>
        <Card className="border-dashed border-border/40 bg-card/30 overflow-hidden">
          <CardContent className="p-0">
            {/* Alfonso */}
            <div className="border-b border-border/30 p-4 flex gap-3">
              <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-[11px] font-medium text-blue-400">
                A
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                What should we prioritize this sprint?
              </p>
            </div>
            {/* Bobby */}
            <div className="border-b border-border/30 p-4 flex gap-3">
              <div className="h-7 w-7 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 text-[11px] font-medium text-purple-400">
                B
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                I think the connector overhaul is most important.{" "}
                <span className="text-primary font-medium">@Alfonso</span> what do you think about
                starting with Google Drive sync?
              </p>
            </div>
            {/* AI response */}
            <div className="p-4 flex gap-3">
              <div className="shrink-0 mt-0.5">
                <NeuralDots size={28} dotCount={5} active />
              </div>
              <div className="text-sm text-foreground leading-relaxed space-y-2">
                <p>
                  Based on your Linear backlog, I&apos;d recommend focusing on three areas:
                </p>
                <div className="flex items-center gap-2 my-1">
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> search_linear_issues
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">12 open issues</span>
                </div>
                <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
                  <li>Connector overhaul — 5 related issues, highest impact</li>
                  <li>Sharing for all content types — 3 issues, user-facing</li>
                  <li>Context library polish — 4 issues, quick wins</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ============================================================ */}
      {/*  Section 10 — Status & Roadmap                               */}
      {/* ============================================================ */}
      <section>
        <SectionHeading title="Status & Roadmap" />

        {/* What's Working */}
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <CircleDot className="h-4 w-4 text-primary" /> Current Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-10">
          {([
            { name: "Chat & AI", status: "green" as const },
            { name: "Artifacts & Sandboxes", status: "green" as const },
            { name: "Knowledge Library", status: "green" as const },
            { name: "Search (Hybrid)", status: "green" as const },
            { name: "Collections & Tags", status: "green" as const },
            { name: "Sharing (Conversations)", status: "green" as const },
            { name: "Integrations", status: "green" as const },
            { name: "Skills", status: "yellow" as const },
            { name: "Connectors Page", status: "yellow" as const },
            { name: "Scheduling", status: "yellow" as const },
            { name: "Notifications", status: "gray" as const },
            { name: "Multi-user Chat", status: "gray" as const },
            { name: "Per-resource Permissions", status: "gray" as const },
            { name: "API / SDK", status: "gray" as const },
          ]).map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-2 rounded-md border border-border/40 bg-card/30 px-3 py-2"
            >
              <StatusDot status={item.status} />
              <span className="text-xs text-foreground">{item.name}</span>
            </div>
          ))}
        </div>

        {/* Up Next */}
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-primary" /> Up Next — P0
        </h3>
        <div className="space-y-2 mb-10">
          {[
            "Context library polish",
            "Connectors & ingestion overhaul",
            "Sharing for all content types",
            "Organization management",
            "Scheduling system rebuild",
            "Notifications & inbox",
          ].map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-md border border-border/40 bg-card/30 px-3 py-2"
            >
              <span className="text-[10px] font-mono text-primary w-4 text-right">{i + 1}</span>
              <span className="text-xs text-foreground">{item}</span>
            </div>
          ))}
        </div>

        {/* On the Horizon */}
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" /> On the Horizon — P1/P2
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            "Multi-user real-time chat",
            "Per-resource permissions & guest access",
            "Public API & SDK",
            "Custom AI agents marketplace",
            "Canvas / whiteboard mode",
            "Voice interface",
            "Mobile app",
            "Cross-org collaboration",
          ].map((item) => (
            <Badge
              key={item}
              variant="outline"
              className="text-[10px] text-muted-foreground border-border/40"
            >
              {item}
            </Badge>
          ))}
        </div>
      </section>

      {/* Footer spacer */}
      <div className="h-12" />
    </div>
  );
}
