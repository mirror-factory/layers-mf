"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Coffee,
  Search,
  MessageSquare,
  FolderKanban,
  Users,
  Zap,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  BarChart3,
  Mic,
  Hash,
  HardDrive,
  GitBranch,
  Brain,
  Inbox,
  Bell,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
/* Using <a> tags instead of Link to avoid strict route type constraints */

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/*  Animation Helpers                                                  */
/* ------------------------------------------------------------------ */

function AnimatedSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      }
    );
  }, []);
  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

function StaggeredItems({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current.children,
      { opacity: 0, x: -20 },
      {
        opacity: 1,
        x: 0,
        duration: 0.4,
        stagger: 0.12,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      }
    );
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flow Diagram Component                                             */
/* ------------------------------------------------------------------ */

function FlowStep({
  icon: Icon,
  color,
  title,
  description,
  isLast = false,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  description: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`flex items-center justify-center h-10 w-10 rounded-full ${color} shrink-0`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        {!isLast && (
          <div className="w-0.5 h-12 bg-border mt-2" />
        )}
      </div>
      <div className="pt-1.5 pb-8">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
          {description}
        </p>
      </div>
    </div>
  );
}

function FlowDiagram({
  steps,
}: {
  steps: {
    icon: LucideIcon;
    color: string;
    title: string;
    description: string;
  }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const items = ref.current.querySelectorAll(".flow-step");
    gsap.fromTo(
      items,
      { opacity: 0, x: -30 },
      {
        opacity: 1,
        x: 0,
        duration: 0.5,
        stagger: 0.2,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  }, []);

  return (
    <div ref={ref}>
      {steps.map((step, i) => (
        <div key={step.title} className="flow-step">
          <FlowStep {...step} isLast={i === steps.length - 1} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Source Badge                                                        */
/* ------------------------------------------------------------------ */

function SourcePill({
  icon: Icon,
  label,
  color,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${color}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Use Cases                                                          */
/* ------------------------------------------------------------------ */

function UseCaseHero() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const tl = gsap.timeline({ delay: 0.2 });
    tl.fromTo(
      ref.current.querySelector(".hero-icon"),
      { scale: 0, rotation: -180 },
      { scale: 1, rotation: 0, duration: 0.8, ease: "back.out(1.7)" }
    )
      .fromTo(
        ref.current.querySelector(".hero-text"),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
        "-=0.3"
      );
  }, []);

  return (
    <div ref={ref} className="mb-16">
      <div className="flex items-center gap-4 mb-4">
        <div className="hero-icon flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20">
          <Layers className="h-7 w-7 text-primary" />
        </div>
        <div className="hero-text">
          <h1 className="text-3xl font-bold tracking-tight">
            How Teams Use Granger
          </h1>
          <p className="text-sm text-muted-foreground">
            Real workflows, step by step
          </p>
        </div>
      </div>
      <p className="text-muted-foreground max-w-2xl leading-relaxed">
        Granger connects your tools into a single knowledge layer. Here&apos;s
        what that looks like in practice — from your morning coffee to your
        end-of-week review.
      </p>
    </div>
  );
}

function UseCase1() {
  return (
    <AnimatedSection className="mb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/10">
          <Coffee className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Your Morning Briefing</h2>
          <p className="text-xs text-muted-foreground">
            7:00 AM — Before you open Slack
          </p>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          You arrive at your desk. Instead of checking Slack, Linear, Google
          Drive, and Discord separately, Granger has already done that for you.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          <SourcePill icon={Hash} label="Slack" color="text-purple-500 border-purple-200 dark:border-purple-800" />
          <SourcePill icon={GitBranch} label="Linear" color="text-indigo-500 border-indigo-200 dark:border-indigo-800" />
          <SourcePill icon={HardDrive} label="Google Drive" color="text-blue-500 border-blue-200 dark:border-blue-800" />
          <SourcePill icon={Mic} label="Granola" color="text-amber-500 border-amber-200 dark:border-amber-800" />
          <SourcePill icon={MessageSquare} label="Discord" color="text-violet-500 border-violet-200 dark:border-violet-800" />
        </div>

        <FlowDiagram
          steps={[
            {
              icon: Bell,
              color: "bg-amber-500",
              title: "Morning Digest Email Arrives",
              description:
                "At 7 AM, Granger emails you a summary: 3 new docs synced from Google Drive, 2 action items from yesterday's meeting, 1 overdue task from Linear, and a key decision made in Slack.",
            },
            {
              icon: Inbox,
              color: "bg-blue-500",
              title: "Open Your Inbox in Granger",
              description:
                "Your inbox shows prioritized items — urgent action items at the top, new context in the middle, and FYI items at the bottom. Each links back to its source.",
            },
            {
              icon: CheckCircle2,
              color: "bg-emerald-500",
              title: "Triage in 2 Minutes",
              description:
                "Mark action items as done, dismiss noise, star the doc you need to review later. Everything across 5 tools, handled in one place.",
            },
          ]}
        />
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-500">5</p>
          <p className="text-[11px] text-muted-foreground">tools checked</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-500">2 min</p>
          <p className="text-[11px] text-muted-foreground">to triage</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-500">0</p>
          <p className="text-[11px] text-muted-foreground">tabs opened</p>
        </Card>
      </div>
    </AnimatedSection>
  );
}

function UseCase2() {
  return (
    <AnimatedSection className="mb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10">
          <Search className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">
            &ldquo;What Did We Decide About Pricing?&rdquo;
          </h2>
          <p className="text-xs text-muted-foreground">
            Finding decisions across tools
          </p>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Your CEO asks about the pricing decision from last week. The answer
          is scattered across a meeting transcript, a Linear issue, a Google
          Doc, and a Slack thread. Without Granger, you&apos;d spend 20 minutes
          hunting.
        </p>

        <FlowDiagram
          steps={[
            {
              icon: MessageSquare,
              color: "bg-blue-500",
              title: "Ask Granger Chat",
              description:
                '"What did we decide about pricing last week?" — Granger expands your query into 4 variations, searches across all sources with hybrid vector + keyword search.',
            },
            {
              icon: Brain,
              color: "bg-purple-500",
              title: "AI Synthesizes Across Sources",
              description:
                "Granger finds the meeting transcript where it was discussed, the Linear issue where it was tracked, the Google Doc with the analysis, and the Slack message confirming it. Trust-weighted ranking puts the Linear issue (authoritative) above the Slack message (context).",
            },
            {
              icon: FileText,
              color: "bg-emerald-500",
              title: "Answer With Citations",
              description:
                '"We decided on usage-based pricing with 3 tiers (Free/Starter/Pro) during the March 12 meeting. Alfonso confirmed in #product on Slack. The full analysis is in the Q1 Pricing Strategy doc." — Each source is clickable.',
            },
          ]}
        />
      </Card>

      <Card className="p-5 bg-muted/30 border-dashed">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          How the search works under the hood
        </h4>
        <StaggeredItems className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>
              <strong>Query expansion:</strong> &ldquo;pricing decision&rdquo; becomes
              4 queries including &ldquo;pricing model&rdquo;, &ldquo;tier structure&rdquo;,
              &ldquo;revenue plan&rdquo;
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>
              <strong>Hybrid search:</strong> Vector similarity finds semantic matches +
              keyword search finds exact terms, merged via RRF
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>
              <strong>Trust weighting:</strong> Linear (1.5x) ranks above Slack (0.7x) —
              decisions tracked in PM tools are more authoritative
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>
              <strong>Freshness decay:</strong> Last week&apos;s content ranks higher than
              3-month-old discussions about old pricing
            </span>
          </div>
        </StaggeredItems>
      </Card>
    </AnimatedSection>
  );
}

function UseCase3() {
  return (
    <AnimatedSection className="mb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-500/10">
          <FolderKanban className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Running a Product Sprint</h2>
          <p className="text-xs text-muted-foreground">
            Sessions keep everything for a project in one place
          </p>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          You&apos;re running a 2-week sprint on the billing system. Context is
          spread across Linear issues, meeting notes, a design doc, and Slack
          discussions. Granger keeps it all scoped.
        </p>

        <FlowDiagram
          steps={[
            {
              icon: FolderKanban,
              color: "bg-indigo-500",
              title: "Create a Session: 'Billing Sprint'",
              description:
                "Sessions are project workspaces. Everything linked to this session stays scoped — when you chat, search, or get insights, it's only about billing.",
            },
            {
              icon: Zap,
              color: "bg-amber-500",
              title: "Content Auto-Links",
              description:
                'When a Linear issue mentions "billing" or "credits", Granger automatically links it to your session. Same for meeting transcripts, Google Docs, and Slack threads. The AI matches by topic similarity.',
            },
            {
              icon: MessageSquare,
              color: "bg-blue-500",
              title: "Session-Scoped Chat",
              description:
                '"What are the open billing issues?" — Chat only searches documents linked to this session. No noise from other projects.',
            },
            {
              icon: Brain,
              color: "bg-purple-500",
              title: "AI Surfaces Insights",
              description:
                '"New insight: The meeting transcript from Monday mentions a March 28 deadline, but PROD-225 (Stripe setup) is still in Backlog." — Granger finds contradictions across sources automatically.',
            },
            {
              icon: BarChart3,
              color: "bg-emerald-500",
              title: "Export for Standup",
              description:
                "Export the session as Markdown — linked documents, decisions, action items, and open questions. Drop it in your standup notes.",
            },
          ]}
        />
      </Card>
    </AnimatedSection>
  );
}

function UseCase4() {
  return (
    <AnimatedSection className="mb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10">
          <Users className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Onboarding a New Team Member</h2>
          <p className="text-xs text-muted-foreground">
            They ask questions, Granger has the answers
          </p>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          A new engineer joins. Instead of scheduling 5 knowledge-transfer
          meetings, you point them at Granger. Every meeting transcript, design
          doc, issue, and decision is already searchable.
        </p>

        <FlowDiagram
          steps={[
            {
              icon: Users,
              color: "bg-emerald-500",
              title: "New Member Joins the Org",
              description:
                "Add them to the team. They instantly have access to every synced document, meeting transcript, and issue in the knowledge base.",
            },
            {
              icon: MessageSquare,
              color: "bg-blue-500",
              title: "They Ask Questions Naturally",
              description:
                '"Why did we choose Supabase over Firebase?" — "What\'s the architecture for the AI pipeline?" — "Who owns the billing integration?" — Granger answers with citations to actual team discussions and documents.',
            },
            {
              icon: Clock,
              color: "bg-amber-500",
              title: "Version History Shows the Journey",
              description:
                "They can see how decisions evolved — the pricing model went through 7 versions before landing on usage-based tiers. The context is there, not just the final answer.",
            },
            {
              icon: CheckCircle2,
              color: "bg-emerald-500",
              title: "Productive in Days, Not Weeks",
              description:
                "Instead of interrupting teammates with questions, they self-serve from the team's collective knowledge. The knowledge base grows with every meeting and every sync.",
            },
          ]}
        />
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-500">5</p>
          <p className="text-[11px] text-muted-foreground">
            meetings saved
          </p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-500">Days</p>
          <p className="text-[11px] text-muted-foreground">
            not weeks to ramp
          </p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-500">100%</p>
          <p className="text-[11px] text-muted-foreground">
            context preserved
          </p>
        </Card>
      </div>
    </AnimatedSection>
  );
}

function UseCase5() {
  return (
    <AnimatedSection className="mb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-500/10">
          <Mic className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">After Every Meeting</h2>
          <p className="text-xs text-muted-foreground">
            Action items extracted and tracked automatically
          </p>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          You just finished a 45-minute planning meeting. Granola captured the
          transcript. Here&apos;s what happens next — automatically.
        </p>

        <FlowDiagram
          steps={[
            {
              icon: Mic,
              color: "bg-red-500",
              title: "Transcript Syncs via Granola",
              description:
                "Within seconds of the meeting ending, the full transcript arrives in Granger via webhook. Token-verified for security.",
            },
            {
              icon: Brain,
              color: "bg-purple-500",
              title: "AI Pipeline Processes It",
              description:
                "7-step pipeline: extract entities (people, decisions, action items, topics) → chunk into searchable passages → generate embeddings → create inbox items → auto-link to relevant sessions.",
            },
            {
              icon: Inbox,
              color: "bg-blue-500",
              title: "Action Items Hit Your Inbox",
              description:
                '"Alfonso to finalize pricing tiers by Friday" — extracted automatically from the transcript and assigned as an action item with a due date.',
            },
            {
              icon: Zap,
              color: "bg-amber-500",
              title: "Sessions Get Updated",
              description:
                'The transcript auto-links to the "Billing Sprint" session because it mentions pricing and credits. Anyone in that session sees the new context immediately.',
            },
            {
              icon: Search,
              color: "bg-emerald-500",
              title: "Searchable Forever",
              description:
                "Six months later, someone asks \"what did we decide in the March planning meeting?\" — Granger finds the exact passage with the decision.",
            },
          ]}
        />
      </Card>
    </AnimatedSection>
  );
}

function UseCase6() {
  return (
    <AnimatedSection className="mb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500/10">
          <BarChart3 className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Weekly Leadership Review</h2>
          <p className="text-xs text-muted-foreground">
            Know what happened across the entire org
          </p>
        </div>
      </div>

      <Card className="p-6 mb-6">
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Friday afternoon. You need to know what shipped, what&apos;s blocked,
          and what decisions were made across every team and tool this week.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <Card className="p-4 bg-muted/30">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
              Ask the AI
            </h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>&ldquo;Summarize what shipped this week&rdquo;</p>
              <p>&ldquo;What decisions were made in meetings?&rdquo;</p>
              <p>&ldquo;Are there any overdue action items?&rdquo;</p>
              <p>&ldquo;What are the open blockers across all projects?&rdquo;</p>
            </div>
          </Card>
          <Card className="p-4 bg-muted/30">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-violet-500" />
              Check the Dashboards
            </h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Content Health: 78/100 score</p>
              <p>23 stale items need review</p>
              <p>6 integrations active, 0 errors</p>
              <p>150 AI queries this week, 93% success</p>
            </div>
          </Card>
        </div>

        <FlowDiagram
          steps={[
            {
              icon: Search,
              color: "bg-violet-500",
              title: "Cross-Source Intelligence",
              description:
                "Granger doesn't just search — it finds connections. \"The design doc updated Tuesday conflicts with the Linear issue assigned to Marcus.\" These cross-source insights surface automatically.",
            },
            {
              icon: FileText,
              color: "bg-blue-500",
              title: "Export the Week's Summary",
              description:
                "Export as Markdown: all decisions, shipped items, open actions, and blockers across every tool — ready for your weekly report or board update.",
            },
          ]}
        />
      </Card>
    </AnimatedSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Data Flow Visualization                                            */
/* ------------------------------------------------------------------ */

function DataFlowSection() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const arrows = ref.current.querySelectorAll(".flow-arrow");
    gsap.fromTo(
      arrows,
      { opacity: 0, scaleX: 0 },
      {
        opacity: 1,
        scaleX: 1,
        duration: 0.3,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );
  }, []);

  return (
    <AnimatedSection className="mb-20">
      <h2 className="text-xl font-semibold mb-2">How Data Flows Through Granger</h2>
      <p className="text-xs text-muted-foreground mb-6">
        From raw content to searchable, actionable intelligence
      </p>

      <Card className="p-6 overflow-x-auto" ref={ref}>
        <div className="min-w-[600px]">
          {/* Row 1: Sources */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <SourcePill icon={HardDrive} label="Drive" color="text-blue-500 border-blue-200 dark:border-blue-800" />
            <SourcePill icon={GitBranch} label="Linear" color="text-indigo-500 border-indigo-200 dark:border-indigo-800" />
            <SourcePill icon={Hash} label="Slack" color="text-purple-500 border-purple-200 dark:border-purple-800" />
            <SourcePill icon={MessageSquare} label="Discord" color="text-violet-500 border-violet-200 dark:border-violet-800" />
            <SourcePill icon={Mic} label="Granola" color="text-amber-500 border-amber-200 dark:border-amber-800" />
          </div>

          <div className="flex justify-center mb-4">
            <ArrowDown className="h-5 w-5 text-muted-foreground flow-arrow" />
          </div>

          {/* Row 2: Ingestion */}
          <div className="flex justify-center mb-4">
            <Badge variant="outline" className="text-xs px-4 py-1.5">
              MCP + Webhook Ingestion
            </Badge>
          </div>

          <div className="flex justify-center mb-4">
            <ArrowDown className="h-5 w-5 text-muted-foreground flow-arrow" />
          </div>

          {/* Row 3: Pipeline */}
          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
            {[
              "Extract",
              "Chunk",
              "Embed",
              "Inbox",
              "Link Sessions",
              "Find Connections",
            ].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <Badge className="text-[10px] bg-primary/10 text-primary border-0">
                  {step}
                </Badge>
                {i < 5 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground flow-arrow" />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center mb-4">
            <ArrowDown className="h-5 w-5 text-muted-foreground flow-arrow" />
          </div>

          {/* Row 4: Storage */}
          <div className="flex justify-center gap-4 mb-4">
            <Badge variant="outline" className="text-xs px-3 py-1.5">
              pgvector (semantic)
            </Badge>
            <Badge variant="outline" className="text-xs px-3 py-1.5">
              tsvector (keyword)
            </Badge>
            <Badge variant="outline" className="text-xs px-3 py-1.5">
              versions (history)
            </Badge>
          </div>

          <div className="flex justify-center mb-4">
            <ArrowDown className="h-5 w-5 text-muted-foreground flow-arrow" />
          </div>

          {/* Row 5: Output */}
          <div className="flex items-center justify-center gap-3">
            <Badge className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 px-3 py-1.5">
              AI Chat
            </Badge>
            <Badge className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 px-3 py-1.5">
              Search
            </Badge>
            <Badge className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 px-3 py-1.5">
              Inbox
            </Badge>
            <Badge className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-0 px-3 py-1.5">
              Insights
            </Badge>
            <Badge className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border-0 px-3 py-1.5">
              Digest
            </Badge>
          </div>
        </div>
      </Card>
    </AnimatedSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function UseCasesPage() {
  useEffect(() => {
    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto" data-testid="use-cases-page">
      <UseCaseHero />
      <DataFlowSection />
      <Separator className="my-16" />
      <UseCase1 />
      <UseCase2 />
      <UseCase3 />
      <UseCase4 />
      <UseCase5 />
      <UseCase6 />

      {/* CTA */}
      <AnimatedSection>
        <Card className="p-8 text-center border-primary/20 bg-primary/[0.02]">
          <h2 className="text-xl font-semibold mb-2">
            Ready to connect your tools?
          </h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Start with one integration. Granger gets smarter with every document,
            message, and meeting you connect.
          </p>
          <div className="flex justify-center gap-3">
            <a
              href="/integrations"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Connect Your First Tool
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/features"
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              View All Features
            </a>
          </div>
        </Card>
      </AnimatedSection>

      <div className="mt-12 text-center text-xs text-muted-foreground">
        <p>Granger — Mirror Factory</p>
      </div>
    </div>
  );
}
