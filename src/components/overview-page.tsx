"use client";

import { useState } from "react";
import { NeuralDots } from "@/components/ui/neural-dots";
import { NeuralMorph } from "@/components/ui/neural-morph";
import { AgentSwarm } from "@/components/ui/agent-swarm";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockFilename,
  CodeBlockActions,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
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
  ChevronDown,
  ChevronRight,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  Code2,
  Link,
  MessageSquareText,
  Check,
  X,
  BarChart3,
  DollarSign,
  Activity,
  Timer,
  Server,
  Building2,
  TrendingUp,
} from "lucide-react";

const SAMPLE_CODE = `import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, MessageSquare } from "lucide-react";

export function DashboardMetrics({ data }: { data: MetricData }) {
  const metrics = [
    { label: "Active Users", value: data.users, icon: Users, delta: "+12%" },
    { label: "Conversations", value: data.chats, icon: MessageSquare, delta: "+8%" },
    { label: "Artifacts", value: data.artifacts, icon: TrendingUp, delta: "+23%" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {metrics.map((m) => (
        <Card key={m.label} className="border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-2xl font-bold">{m.value.toLocaleString()}</p>
            </div>
            <span className="text-xs text-emerald-400">{m.delta}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}`;

const SAMPLE_HTML = [
  "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'/>",
  "<meta name='viewport' content='width=device-width,initial-scale=1.0'/>",
  "<script src='https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js'></script>",
  "<style>*{margin:0;padding:0;box-sizing:border-box}",
  "body{background:#0a0a0b;color:#e4e4e7;font-family:system-ui,sans-serif;padding:24px}",
  ".g{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}",
  ".m{background:#18181b;border:1px solid #27272a;border-radius:8px;padding:16px}",
  ".m .l{font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.05em}",
  ".m .v{font-size:28px;font-weight:700;margin-top:4px}.m .d{font-size:12px;color:#34d399;margin-top:2px}",
  ".cc{background:#18181b;border:1px solid #27272a;border-radius:8px;padding:16px}",
  ".ct{font-size:13px;color:#a1a1aa;margin-bottom:12px}</style></head><body>",
  "<div class='g'>",
  "<div class='m'><div class='l'>Active Users</div><div class='v' id='u'>0</div><div class='d'>+12%</div></div>",
  "<div class='m'><div class='l'>Conversations</div><div class='v' id='c'>0</div><div class='d'>+8%</div></div>",
  "<div class='m'><div class='l'>Artifacts Created</div><div class='v' id='a'>0</div><div class='d'>+23%</div></div>",
  "</div><div class='cc'><div class='ct'>Weekly Activity</div><canvas id='ch' height='120'></canvas></div>",
  "<script>function av(e,n,d){let s=null;function t(ts){if(!s)s=ts;const p=Math.min((ts-s)/d,1);",
  "e.textContent=Math.floor(p*n).toLocaleString();if(p<1)requestAnimationFrame(t)}requestAnimationFrame(t)}",
  "av(document.getElementById('u'),1247,1200);av(document.getElementById('c'),3891,1400);",
  "av(document.getElementById('a'),562,1000);",
  "new Chart(document.getElementById('ch'),{type:'bar',data:{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],",
  "datasets:[{label:'Conversations',data:[42,58,71,63,89,34,47],backgroundColor:'rgba(168,85,247,0.5)',",
  "borderColor:'rgba(168,85,247,0.8)',borderWidth:1,borderRadius:4}]},options:{responsive:true,",
  "plugins:{legend:{display:false}},scales:{x:{grid:{color:'#27272a'},ticks:{color:'#71717a',font:{size:11}}},",
  "y:{grid:{color:'#27272a'},ticks:{color:'#71717a',font:{size:11}}}}}});</script></body></html>",
].join("");

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

function ChatDemoCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("border-border/60 bg-zinc-950/80 overflow-hidden", className)}>
      <CardContent className="p-0 space-y-0 divide-y divide-border/30">
        {children}
      </CardContent>
    </Card>
  );
}

function ChatRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-4 py-3", className)}>{children}</div>;
}

function CitationPill({ url, label }: { url: string; label: string }) {
  const domain = new URL(url).hostname;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
        alt=""
        className="h-3 w-3 rounded-sm"
        width={12}
        height={12}
      />
      {label}
    </a>
  );
}

function InterviewDemo() {
  const choices = ["Manual", "Scheduled", "Event-driven"];
  const sources = ["Linear", "Slack", "GitHub", "Google Drive"];
  return (
    <div className="rounded-lg border bg-card shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Interview: Skill Requirements</span>
        </div>
        <button className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="px-4 pt-3 text-xs text-muted-foreground">Help me understand the requirements for this new skill.</p>
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Skill name <span className="text-destructive ml-0.5">*</span></label>
          <input type="text" readOnly value="Daily Standup Report" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Trigger type <span className="text-destructive ml-0.5">*</span></label>
          <div className="flex flex-wrap gap-2">
            {choices.map((opt) => (
              <span key={opt} className={cn("rounded-md border px-3 py-1.5 text-xs font-medium", opt === "Scheduled" ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>{opt}</span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Data sources</label>
          <div className="flex flex-wrap gap-2">
            {sources.map((opt) => {
              const sel = opt === "Linear" || opt === "Slack";
              return <span key={opt} className={cn("rounded-md border px-3 py-1.5 text-xs font-medium flex items-center gap-1.5", sel ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>{sel && <Check className="h-3 w-3" />}{opt}</span>;
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t bg-muted/30">
        <Button variant="ghost" size="sm">Skip</Button>
        <Button size="sm"><Check className="h-3.5 w-3.5 mr-1.5" />Submit</Button>
      </div>
    </div>
  );
}

export function OverviewPage() {
  const [heroFormation] = useState<"galaxy">("galaxy");
  const [showUpNext, setShowUpNext] = useState(false);
  const [showHorizon, setShowHorizon] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 space-y-24">
      {/*  Section 1 — Hero                                            */}
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

      {/*  Section 2 — The Stack                                       */}
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

      {/*  Section 3 — Chat System                                     */}
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
              and runs code, creates documents, and manages project issues -- all in one thread.
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

          {/* Chat demo 1: Knowledge search */}
          <ChatDemoCard>
            <ChatRow>
              <Message from="user">
                <MessageContent>
                  What were the key decisions from yesterday&apos;s meeting?
                </MessageContent>
              </Message>
            </ChatRow>
            <ChatRow className="py-2">
              <Tool>
                <ToolHeader type="tool-search_context" state="output-available" />
                <ToolContent>
                  <ToolOutput
                    output="Found 3 matching documents in knowledge base"
                    errorText={undefined}
                  />
                </ToolContent>
              </Tool>
            </ChatRow>
            <ChatRow>
              <div className="flex gap-3">
                <div className="shrink-0 mt-1">
                  <NeuralDots size={24} dotCount={5} />
                </div>
                <Message from="assistant">
                  <MessageContent>
                    <MessageResponse>{`Based on the meeting notes from April 5, three key decisions were made:

1. **Prioritize connector overhaul** for Q2
2. **Move scheduling** to background jobs architecture
3. **Ship sharing** for conversations this week

*Source: Meeting Notes -- April 5 Standup*`}</MessageResponse>
                  </MessageContent>
                </Message>
              </div>
            </ChatRow>
          </ChatDemoCard>
        </div>

        {/* Chat demo 2: Artifact creation */}
        <div className="mt-6">
          <ChatDemoCard>
            <ChatRow>
              <Message from="user">
                <MessageContent>
                  Build me a landing page for Mirror Factory
                </MessageContent>
              </Message>
            </ChatRow>
            <ChatRow className="py-2">
              <Tool>
                <ToolHeader type="tool-write_code" state="output-available" />
                <ToolContent>
                  <ToolOutput
                    output="Created artifact: mirror-factory-landing (React + Tailwind)"
                    errorText={undefined}
                  />
                </ToolContent>
              </Tool>
            </ChatRow>
            <ChatRow>
              <div className="flex gap-3">
                <div className="shrink-0 mt-1">
                  <NeuralDots size={24} dotCount={5} />
                </div>
                <Message from="assistant">
                  <MessageContent>
                    <MessageResponse>{`I've created a landing page for **Mirror Factory** with a hero section, feature grid, and CTA. The sandbox is running with a live preview.

You can view it in the artifact panel or open the sandbox URL directly.`}</MessageResponse>
                  </MessageContent>
                </Message>
              </div>
            </ChatRow>
          </ChatDemoCard>
        </div>

        {/* Chat demo 3: Web Search */}
        <div className="mt-6">
          <ChatDemoCard>
            <ChatRow>
              <Message from="user">
                <MessageContent>
                  What&apos;s the latest on the AI SDK v6 release?
                </MessageContent>
              </Message>
            </ChatRow>
            <ChatRow className="py-2">
              <div className="flex items-center gap-2">
                <Tool>
                  <ToolHeader type="tool-web_search" state="output-available" />
                </Tool>
                <Badge variant="outline" className="text-[9px] border-border/40 text-muted-foreground gap-1">
                  <Globe className="h-2.5 w-2.5" /> Perplexity
                </Badge>
              </div>
            </ChatRow>
            <ChatRow>
              <div className="flex gap-3">
                <div className="shrink-0 mt-1">
                  <NeuralDots size={24} dotCount={5} />
                </div>
                <Message from="assistant">
                  <MessageContent>
                    <MessageResponse>{`AI SDK v6 was released with several major changes:

- **ToolLoopAgent** replaces manual tool loop patterns
- **UIMessage** is the new message format (replaces v5 Message type)
- **createAgentUIStream** for server-side agent streaming

The migration guide covers all breaking changes from v5.`}</MessageResponse>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <CitationPill url="https://sdk.vercel.ai/docs" label="AI SDK Docs" />
                      <CitationPill url="https://vercel.com/blog" label="Vercel Blog" />
                      <CitationPill url="https://github.com/vercel/ai" label="GitHub" />
                    </div>
                  </MessageContent>
                </Message>
              </div>
            </ChatRow>
          </ChatDemoCard>
        </div>

        {/* Interview Tool Demo */}
        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5 text-primary" />
            The ask_user tool presents structured interview forms mid-conversation:
          </p>
          <InterviewDemo />
        </div>
      </section>

      {/*  Section 4 — Artifacts & Sandbox                             */}
      <section>
        <SectionHeading
          title="Artifacts & Sandbox"
          subtitle="Code, documents, and live previews -- all versioned, all sandboxed."
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
            <CodeBlock code={SAMPLE_CODE} language="tsx" showLineNumbers>
              <CodeBlockHeader>
                <CodeBlockTitle>
                  <CodeBlockFilename>dashboard-metrics.tsx</CodeBlockFilename>
                </CodeBlockTitle>
                <CodeBlockActions>
                  <CodeBlockCopyButton />
                </CodeBlockActions>
              </CodeBlockHeader>
            </CodeBlock>
          </TabsContent>

          <TabsContent value="document">
            <Card className="border-border/60 bg-card/50">
              <CardContent className="p-4 space-y-4">
                {/* Formatting toolbar */}
                <div className="flex gap-1 border-b border-border/40 pb-3">
                  {[
                    { icon: Bold, label: "Bold" },
                    { icon: Italic, label: "Italic" },
                    { icon: Heading1, label: "Heading 1" },
                    { icon: Heading2, label: "Heading 2" },
                    { icon: List, label: "List" },
                    { icon: Code2, label: "Code" },
                    { icon: Link, label: "Link" },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      aria-label={btn.label}
                    >
                      <btn.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
                {/* Document content */}
                <div className="prose prose-sm prose-invert max-w-none space-y-3">
                  <h2 className="text-lg font-semibold text-foreground m-0">
                    Q2 Connector Overhaul Plan
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This document outlines the plan for rebuilding our integration connectors
                    in Q2. The goal is to move from polling-based ingestion to real-time
                    webhooks with incremental sync.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
                    <li>Migrate Google Drive to push notifications via Changes API</li>
                    <li>Add Slack real-time events for channel messages</li>
                    <li>Implement GitHub webhook handlers for repo activity</li>
                    <li>Build unified retry and error handling layer</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card className="border-border/60 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 gap-1">
                      <StatusDot status="green" /> Running
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      sandbox-3k0h486n
                    </span>
                  </div>
                  <Play className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <iframe
                  srcDoc={SAMPLE_HTML}
                  className="w-full h-64 rounded-lg border border-border/40 bg-zinc-950"
                  title="Live sandbox preview"
                  sandbox="allow-scripts"
                />
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

      {/*  Section 4b — Cost & Token Visibility                         */}
      <section>
        <SectionHeading
          title="Cost & Token Visibility"
          subtitle="Full observability into every LLM call -- tokens, cache hits, cost, and timing -- per message, per conversation, per user, per org."
        />

        {/* --- Narrative: what this visibility means --- */}
        <div className="mb-10 max-w-3xl space-y-5 text-sm text-muted-foreground leading-relaxed">
          <p>
            Every AI interaction is tracked -- model used, tokens consumed, time to respond,
            cache efficiency, and actual cost. This data flows into a unified analytics layer
            that serves both individual users and organization admins.
          </p>

          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">For Individuals</h4>
            <ul className="space-y-1.5">
              {[
                "See exactly what each message costs via the info popover on every assistant response",
                "Compare models by switching mid-conversation and seeing the cost difference in real time",
                "Monitor cache hit rates -- consecutive messages on the same model get up to 90% cheaper",
                "Full conversation cost breakdown showing every LLM call, its tokens, and its cache performance",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  <span className="text-[11px]">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">For Organizations</h4>
            <ul className="space-y-1.5">
              {[
                "Aggregate dashboard: total spend, per-user breakdown, per-provider costs over configurable periods",
                "Track which models deliver the best value for your team's use cases",
                "Credit budgets with alerts before they run out",
                "Export usage data for billing, accounting, and forecasting",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  <span className="text-[11px]">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-foreground/80 font-medium">
            Most AI platforms show you a monthly bill. Layers shows you the cost of every single
            message, every tool call, every cache hit -- in real time, per user, per model, per
            provider. You never wonder &quot;why was this month expensive.&quot;
          </p>

          {/* Data captured callout */}
          <Card className="border-border/60 bg-zinc-950/80">
            <CardContent className="p-4">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold block mb-2">
                Data captured per message
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Model",
                  "TTFT",
                  "Total Time",
                  "Input Tokens",
                  "Output Tokens",
                  "Cache Read",
                  "Cache Write",
                  "Cost",
                  "Tools Used",
                  "Step Count",
                ].map((field) => (
                  <span
                    key={field}
                    className="text-[10px] font-mono text-foreground/70 bg-zinc-800/80 rounded px-2 py-0.5"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- What We Track (3x2 grid) --- */}
        <div className="mb-10">
          <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">What We Track</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              { icon: MessageSquare, title: "Per Message", items: ["Model used", "TTFT + total time", "Input / output tokens", "Cache hits + rate", "Cost in USD"] },
              { icon: MessageSquareText, title: "Per Conversation", items: ["Total tokens", "Total cost", "Model breakdown", "Average TTFT", "Step count"] },
              { icon: Users, title: "Per User", items: ["Total usage", "Most used model", "Total cost", "Conversation count", "Avg cost/request"] },
              { icon: Building2, title: "Per Organization", items: ["Aggregate usage", "Cost by provider", "Credit balance", "Active users", "Budget tracking"] },
              { icon: Server, title: "Per Provider", items: ["Requests", "Tokens in/out", "Total cost", "Avg latency", "Cache efficiency"] },
              { icon: Cpu, title: "Per Model", items: ["Request count", "Avg tokens", "Cost efficiency", "Cache hit rate", "Avg TTFT"] },
            ] as const).map((card) => (
              <Card key={card.title} className="border-border/60 bg-zinc-950/80">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <card.icon className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">{card.title}</span>
                  </div>
                  <ul className="space-y-1">
                    {card.items.map((item) => (
                      <li key={item} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* --- Simulated Analytics Dashboard --- */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">Analytics Dashboard</h3>

          {/* Summary cards row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {([
              { label: "Total Requests", value: "1,247", sub: "past 7 days", icon: Activity },
              { label: "Total Cost", value: "$12.45", sub: "across all providers", icon: DollarSign },
              { label: "Cache Hit Rate", value: "72%", sub: "saves ~$30/week", icon: TrendingUp },
              { label: "Avg TTFT", value: "380ms", sub: "time to first token", icon: Timer },
            ] as const).map((card) => (
              <Card key={card.label} className="border-border/60 bg-zinc-950/80">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{card.label}</span>
                    <card.icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </div>
                  <div className="text-xl font-bold text-foreground font-mono tabular-nums">{card.value}</div>
                  <span className="text-[10px] text-muted-foreground">{card.sub}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by Provider — horizontal bar chart */}
            <Card className="border-border/60 bg-zinc-950/80">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Cost by Provider</span>
                </div>
                <div className="space-y-3">
                  {([
                    { provider: "Anthropic", cost: 8.20, pct: 66, color: "bg-primary", isLocal: false },
                    { provider: "OpenAI", cost: 3.15, pct: 25, color: "bg-blue-500", isLocal: false },
                    { provider: "Google", cost: 1.10, pct: 9, color: "bg-amber-500", isLocal: false },
                    { provider: "Ollama", cost: 0, pct: 0, color: "bg-zinc-700", isLocal: true },
                  ] as const).map((row) => (
                    <div key={row.provider} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-foreground/80">{row.provider}</span>
                        <div className="flex items-center gap-2">
                          {row.isLocal && (
                            <Badge variant="outline" className="text-[8px] border-zinc-600 text-zinc-400 px-1.5 py-0">LOCAL</Badge>
                          )}
                          <span className="text-[11px] text-foreground font-mono tabular-nums">
                            ${row.cost.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        {row.pct > 0 && (
                          <div
                            className={cn("h-full rounded-full transition-all", row.color)}
                            style={{ width: `${row.pct}%` }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Tools */}
            <Card className="border-border/60 bg-zinc-950/80">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Top Tools</span>
                </div>
                <div className="space-y-2">
                  {([
                    { tool: "search_context", count: 456, pct: 100 },
                    { tool: "write_code", count: 89, pct: 19 },
                    { tool: "web_search", count: 67, pct: 15 },
                    { tool: "get_document", count: 42, pct: 9 },
                    { tool: "edit_code", count: 31, pct: 7 },
                  ] as const).map((row) => (
                    <div key={row.tool} className="flex items-center gap-3">
                      <code className="text-[10px] text-foreground/70 font-mono w-28 truncate shrink-0">{row.tool}</code>
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono tabular-nums w-10 text-right shrink-0">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Model Usage table */}
          <Card className="border-border/60 bg-zinc-950/80 mt-6">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Model Usage</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border/30">
                      {["Model", "Requests", "Avg TTFT", "Tokens", "Cost", "Cache"].map((h) => (
                        <th key={h} className="text-left text-muted-foreground font-medium py-2 px-2 first:pl-0 last:pr-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {([
                      { model: "Claude Sonnet 4.6", requests: 420, ttft: "680ms", tokens: "2.1M", cost: "$8.20", cache: "78%" },
                      { model: "Gemini Flash", requests: 380, ttft: "320ms", tokens: "1.8M", cost: "$0.95", cache: "82%" },
                      { model: "GPT-5 Nano", requests: 200, ttft: "450ms", tokens: "890K", cost: "$0.15", cache: "65%" },
                      { model: "Gemma 4 26B (Local)", requests: 247, ttft: "250ms", tokens: "1.2M", cost: "$0", cache: "N/A" },
                    ] as const).map((row) => (
                      <tr key={row.model} className="border-b border-border/20 last:border-0">
                        <td className="py-2 px-2 pl-0 text-foreground/80 font-sans">{row.model}</td>
                        <td className="py-2 px-2 tabular-nums text-foreground/70">{row.requests}</td>
                        <td className="py-2 px-2 tabular-nums text-foreground/70">{row.ttft}</td>
                        <td className="py-2 px-2 tabular-nums text-foreground/70">{row.tokens}</td>
                        <td className="py-2 px-2 tabular-nums text-primary font-medium">{row.cost}</td>
                        <td className="py-2 px-2 pr-0">
                          {row.cache === "N/A" ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : (
                            <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 px-1.5 py-0">
                              {row.cache}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* What This Enables */}
          <Card className="border-border/60 bg-zinc-950/80 mt-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">What This Enables</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {[
                  "Track cost per user, per day, per provider",
                  "Identify most expensive conversations",
                  "Monitor cache hit rates (higher = cheaper)",
                  "Compare model performance (TTFT, throughput)",
                  "Set cost alerts and budgets",
                  "Export usage data for billing",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 pt-4 border-t border-border/30">
            <a href="/analytics/costs" className="text-xs text-primary hover:underline flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3" />
              Open full analytics dashboard
            </a>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  Section 4c — Local Model Testing                              */}
      {/* ============================================================ */}
      <section>
        <SectionHeading
          title="Local Model Testing"
          subtitle="Run Gemma 4 26B on your machine via Ollama. Free, private, offline-capable. No API costs during development."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              During development, Layers connects to Ollama running locally on your machine.
              The model selector automatically shows local models on localhost and hides them
              in production. No configuration needed — it just works.
            </p>
            <ul className="space-y-2">
              {[
                "Gemma 4 26B running locally (17GB, Q4_K_M quantization)",
                "Zero API costs — unlimited testing during development",
                "250ms time to first token (faster than cloud — no network latency)",
                "65 tokens/sec streaming on Apple Silicon",
                "Full tool calling support (all 43 tools work locally)",
                "Model stays in GPU memory (keep_alive: -1 prevents unloading)",
                "Slim system prompt (~100 tokens vs ~10,000 for cloud)",
                "Skips credentials, MCP, rules loading for fast request setup",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Performance comparison card */}
          <Card className="border-border/60 bg-card/50">
            <CardContent className="p-5 space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Performance Comparison</h4>
              <div className="space-y-3">
                {([
                  { label: "Time to First Token", local: "250ms", cloud: "500-1500ms", faster: true },
                  { label: "Throughput", local: "65 tok/s", cloud: "30-80 tok/s", faster: false },
                  { label: "Simple Response", local: "~1.5s", cloud: "~2-3s", faster: true },
                  { label: "Cost per Request", local: "$0", cloud: "$0.001-0.05", faster: true },
                  { label: "Cold Start", local: "15-20s", cloud: "N/A", faster: false },
                  { label: "Privacy", local: "On-device", cloud: "Provider servers", faster: true },
                ] as { label: string; local: string; cloud: string; faster: boolean }[]).map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground w-36">{row.label}</span>
                    <span className={row.faster ? "text-primary font-medium" : "text-foreground"}>{row.local}</span>
                    <span className="text-muted-foreground/50 px-2">vs</span>
                    <span className={!row.faster ? "text-primary font-medium" : "text-foreground"}>{row.cloud}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground">
                  Local models only available on localhost. Production uses AI Gateway cloud models.
                  Switch between local and cloud anytime via the model selector.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/*  Section 5 — Tools & Capabilities                            */}
      <section>
        <SectionHeading
          title="Tools & Capabilities"
          subtitle="The agent's toolkit -- each tool is a capability the AI can invoke autonomously during conversations."
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

        {/* Parallel Execution */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <h3 className="text-base font-semibold text-foreground">Parallel Execution</h3>
            <p>
              Tools run in parallel when they have no dependencies. The agent dispatches
              multiple tool calls simultaneously -- searching your knowledge base, checking
              Linear, and querying meetings all at once -- then synthesizes results once
              every branch completes.
            </p>
            <p>
              This dramatically reduces latency for multi-step tasks compared to sequential
              execution.
            </p>
          </div>
          <div className="flex justify-center py-4">
            <AgentSwarm
              animated
              size={36}
              agents={[
                { name: "Checking Linear", status: "complete" },
                { name: "Querying meetings", status: "complete" },
                { name: "Searching knowledge base", status: "running" },
                { name: "Drafting email", status: "pending" },
                { name: "Reviewing compliance", status: "pending" },
              ]}
            />
          </div>
        </div>
      </section>

      {/*  Section 6 — Scheduling Vision                               */}
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

      {/*  Section 7 — Connectors & MCP                                */}
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

      {/*  Section 8 — Sharing & Organizations                         */}
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
                desc: "Public URLs -- anyone with the link can view",
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

      {/*  Section 9 — Multi-User Chat Vision                          */}
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
                  <li>Connector overhaul -- 5 related issues, highest impact</li>
                  <li>Sharing for all content types -- 3 issues, user-facing</li>
                  <li>Context library polish -- 4 issues, quick wins</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/*  Section 9b — Agent Orchestration                             */}
      <section>
        <SectionHeading
          title="Agent Orchestration"
          subtitle="The primary agent delegates to specialists. Each runs independently, returns results, and the orchestrator synthesizes."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Sub-agents -- Linear, Gmail, Drive, Notion -- each operate in their own tool
              loop with dedicated context. The orchestrator dispatches work in parallel,
              collects structured outputs, and merges everything into a single coherent
              response.
            </p>
            <p>
              Each specialist agent has its own set of tools and permissions, enforcing
              least-privilege access across integrations.
            </p>
          </div>
          <div className="flex justify-center py-4">
            <AgentSwarm
              animated
              size={36}
              agents={[
                { name: "Linear Agent", status: "complete" },
                { name: "Gmail Agent", status: "complete" },
                { name: "Drive Agent", status: "running" },
                { name: "Notion Agent", status: "running" },
              ]}
            />
          </div>
        </div>
      </section>

      {/*  Section 10 — Status & Roadmap                               */}
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
            { name: "Scheduling", status: "green" as const },
            { name: "Notifications", status: "green" as const },
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

        {/* Up Next -- P0 */}
        <button
          type="button"
          onClick={() => setShowUpNext((v) => !v)}
          className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2 hover:text-primary transition-colors"
        >
          {showUpNext ? (
            <ChevronDown className="h-4 w-4 text-primary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-primary" />
          )}
          Up Next -- P0
        </button>
        {showUpNext && (
          <div className="space-y-3 mb-10">
            {([
              { title: "Context library polish", desc: "Content detail panels, bulk actions (select multiple items to tag, move, archive), empty states, filter persistence across sessions, and responsive grid/list layouts that work on every screen size." },
              { title: "Connectors & ingestion overhaul", desc: "Replace the monolithic 1,285-line sync route with a queue-based pipeline. Semantic chunking (400-512 tokens, not 12K truncation), incremental sync via webhooks, retry with dead-letter queue, and deduplication across sources." },
              { title: "Sharing for all content types", desc: "Public share links for artifacts, documents, and context items (not just conversations). Token-protected links with optional passwords and expiry. Email and SMS sharing for people without Layers accounts. Download and export as PDF, DOCX, ZIP." },
              { title: "Organization management", desc: "Org dashboard showing member count, content stats, AI usage and costs. Org-level rules that apply to every member's chat. Activity feed showing who added, shared, or changed what. The org as a mirror of a person -- its own library, priorities, and identity." },
              { title: "Scheduling system", desc: "Background chats that run on a cron schedule. The AI executes a prompt autonomously, searches your knowledge base, generates artifacts or sandbox dashboards, and sends you a desktop notification with the link. Example: every morning at 9am, get news + weather + calendar in a dashboard." },
              { title: "Notifications & inbox", desc: "Unified notification system across desktop, email, and in-app. Triggered by scheduled task completion, content shares, chat mentions, approval requests, integration errors, and credit alerts. Notification preferences per channel and type." },
            ] as { title: string; desc: string }[]).map((item, i) => (
              <div
                key={item.title}
                className="rounded-lg border border-border/40 bg-card/30 p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-mono text-primary font-bold w-4 text-right">{i + 1}</span>
                  <span className="text-sm font-semibold text-foreground">{item.title}</span>
                </div>
                <p className="text-xs text-muted-foreground ml-7 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* On the Horizon -- P1/P2 */}
        <button
          type="button"
          onClick={() => setShowHorizon((v) => !v)}
          className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2 hover:text-primary transition-colors"
        >
          {showHorizon ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          On the Horizon -- P1/P2
        </button>
        {showHorizon && <div className="space-y-3">
          {([
            { title: "Parallel agents & orchestration", desc: "Spawn multiple sub-agents from a single conversation. Each agent works independently -- one searches Linear, another queries Gmail, another checks the knowledge base -- all in parallel. Results converge back to the orchestrator for synthesis. Agent memory persists across conversations. Different models for different tasks (fast model for search, flagship for code gen)." },
            { title: "Image generation & media tools", desc: "Generate images via AI Gateway (DALL-E, Stable Diffusion, Flux, Recraft). Edit images (inpaint, outpaint, upscale, background removal). Audio transcription via Whisper, text-to-speech via ElevenLabs. Media stored as artifacts alongside code and documents. Gallery view for image collections." },
            { title: "Content authoring & publishing", desc: "Create documents, reports, and presentations directly in chat, then publish to multiple destinations. Guided authoring wizard with AI assist. Export to PDF, DOCX, or deploy as a static site on Vercel. Snapshot sandboxes as shareable static pages." },
            { title: "Cross-platform sharing", desc: "Share Layers content TO other platforms: ChatGPT (as knowledge files), Claude (via MCP -- Layers becomes a server others connect to), Slack (post summaries to channels), Notion (bidirectional sync), Email (formatted content with token-protected links), Discord (bot integration). A guided wizard walks you through connecting Layers to your tools." },
            { title: "Layers as MCP server", desc: "Expose your organization's knowledge as an MCP endpoint. Other AI tools (Claude Desktop, Cursor, custom apps) connect to Layers and search your documents, meetings, and context -- without leaving their environment. Your knowledge base becomes an API anyone can query." },
            { title: "Token & passcode sharing", desc: "Share specific content with people who don't have Layers accounts. Generate time-limited access tokens with optional passcodes. A lightweight guest portal renders the content read-only. QR codes for sandbox previews and shared documents. SMS and email delivery of protected links." },
            { title: "Multi-user real-time chat", desc: "Multiple team members in one conversation with the AI. @mention Bobby -- he gets notified and can respond in the thread. @mention the AI -- it responds when tagged. Toggle on 'AI watching' mode where the AI monitors the conversation and jumps in when it can help, like a team member who's always available." },
            { title: "Per-resource permissions & approvals", desc: "View, comment, edit, and admin permissions per item. Permission inheritance flows from org defaults to collections to individual items. Approval workflows for document edits and scheduled tasks. Pending approvals surface in the inbox with hierarchy-based routing." },
            { title: "Public API & SDK", desc: "Every Layers feature accessible via a documented API. TypeScript and Python SDK packages. API playground for testing. Rate limiting and usage tracking per API key. The frontend is just one consumer of the API -- others can build their own interfaces, integrations, and automations on top." },
            { title: "Voice interface & live transcription", desc: "Live voice conversations with the AI using Gemini Live API. Real-time transcription of meetings and calls. Voice commands for hands-free operation. Audio artifacts stored alongside text and code." },
            { title: "Canvas & whiteboard", desc: "Visual collaboration space with AI assist. Draw diagrams, map out architectures, brainstorm with sticky notes. The AI can read the canvas and suggest improvements, generate code from diagrams, or turn sketches into artifacts." },
            { title: "Workflow builder", desc: "Visual tool for creating multi-step automations. Drag-and-drop nodes: triggers (schedule, webhook, event), actions (search, generate, share, notify), conditions (if/then branching). Connect tools into pipelines that run autonomously. Like Zapier but with your AI and your knowledge base." },
          ] as { title: string; desc: string }[]).map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-border/20 bg-card/20 p-4"
            >
              <p className="text-sm font-medium text-foreground mb-1">{item.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>}
      </section>

      {/* Footer spacer */}
      <div className="h-12" />
    </div>
  );
}
