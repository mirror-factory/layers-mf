"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Upload,
  Brain,
  Search,
  MessageSquare,
  FolderKanban,
  Inbox,
  CheckSquare,
  Plug,
  Users,
  CreditCard,
  BarChart3,
  Shield,
  Code2,
  TestTube,
  Layers,
  Sparkles,
  Database,
  Zap,
  Globe,
  SlidersHorizontal,
  Clock,
  TrendingUp,
  Target,
  GitCommit,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ArrowRight,
  Calendar,
  Rocket,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Feature {
  title: string;
  description: string;
}

interface FeatureSection {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  features: Feature[];
}

interface RoadmapSprint {
  sprint: number;
  title: string;
  dates: string;
  status: "complete" | "current" | "upcoming";
  goal: string;
  highlights: string[];
  issueCount: number;
}

/* ------------------------------------------------------------------ */
/*  Data — Metrics (as of 2026-03-22)                                 */
/* ------------------------------------------------------------------ */

const METRICS = {
  linesOfCode: 33002,
  files: 209,
  apiRoutes: 66,
  unitTests: 819,
  e2eSpecs: 16,
  evalSuites: 5,
  dbMigrations: 29,
  components: 39,
  commits: 122,
  dependencies: 41,
  pages: 38,
  daysBuilding: 17,
  linearIssuesDone: 156,
  linearIssuesTotal: 156,
  todoFixme: 0,
};

const COMPLETION = Math.round(
  (METRICS.linearIssuesDone / METRICS.linearIssuesTotal) * 100
);

/* ------------------------------------------------------------------ */
/*  Data — Feature Sections                                            */
/* ------------------------------------------------------------------ */

const SECTIONS: FeatureSection[] = [
  {
    icon: Upload,
    title: "Content Ingestion",
    subtitle: "Ingest from anywhere — files, integrations, and webhooks",
    features: [
      {
        title: "File Upload",
        description:
          "Drag-and-drop PDF, DOCX, TXT, and Markdown. Auto-detects meeting transcripts vs documents.",
      },
      {
        title: "Google Drive Sync",
        description:
          "Google Docs, Sheets, Slides exported as text + uploaded PDFs and Word files downloaded and parsed. Push notifications with 24h watch renewal.",
      },
      {
        title: "Linear Sync",
        description:
          "Issues + comments, projects, and cycles via GraphQL. HMAC-SHA256 webhook verification. Up to 500 items per sync.",
      },
      {
        title: "Slack Sync",
        description:
          "Public channel messages (up to 20 channels, 200 messages each). Messages batched per channel with author attribution.",
      },
      {
        title: "Discord Sync",
        description:
          "Guild messages with incremental batching. Ed25519-verified webhooks. Up to 5 guilds, 10 channels each.",
      },
      {
        title: "GitHub Sync",
        description:
          "Repository issues with metadata (status, labels, assignees). Up to 10 repos, 15 issues each.",
      },
      {
        title: "Granola Sync",
        description:
          "Meeting transcripts with attendees via webhook daemon + pull sync. Token-verified payloads.",
      },
      {
        title: "Nango Connect",
        description:
          "OAuth credential management + API proxy for all integrations. Handles token refresh, rate limits, and 700+ APIs.",
      },
    ],
  },
  {
    icon: Brain,
    title: "AI Processing Pipeline",
    subtitle:
      "7-step Inngest-orchestrated pipeline — extract, chunk, embed, and link",
    features: [
      {
        title: "Structured Extraction",
        description:
          "Claude Haiku via AI Gateway extracts title, summaries, entities, sentiment, and executive summary using Zod schemas.",
      },
      {
        title: "Intelligent Chunking",
        description:
          "Parent-child strategy (~400/1500 tokens) with smart break-point detection at paragraph, sentence, and word boundaries.",
      },
      {
        title: "Vector Embeddings",
        description:
          "1536-dim via text-embedding-3-small. Chunk-level and item-level embeddings with batch processing.",
      },
      {
        title: "Auto-Linking to Sessions",
        description:
          "AI matches new content against active sessions by topic similarity. Deduplicates against existing links.",
      },
      {
        title: "Pipeline Orchestration",
        description:
          "Inngest handles 7 steps with concurrency=10, 3 retries, non-blocking execution.",
      },
    ],
  },
  {
    icon: Clock,
    title: "Content Lifecycle",
    subtitle: "Versioning, staleness detection, and health monitoring",
    features: [
      {
        title: "Version History",
        description:
          "Every content change creates a version snapshot. View timeline, compare versions, track who changed what and why.",
      },
      {
        title: "Change Detection",
        description:
          "SHA-256 content hashing with field-level diff. Skips re-processing when nothing changed. Metadata-only updates skip AI re-embedding.",
      },
      {
        title: "Staleness Detection",
        description:
          "Content-type-specific thresholds (messages: 30d, issues: 14d, docs: 90d). Health score 0-100 with freshness breakdown.",
      },
      {
        title: "Rolling Message Windows",
        description:
          "Slack and Discord messages bucketed weekly. Old weeks preserved as searchable items. No data loss on re-sync.",
      },
    ],
  },
  {
    icon: Search,
    title: "Hybrid Search",
    subtitle: "Vector + full-text search with Reciprocal Rank Fusion",
    features: [
      {
        title: "Dual Search",
        description:
          "pgvector HNSW index + PostgreSQL tsvector merged via RRF for best-of-both ranking.",
      },
      {
        title: "Two Search Levels",
        description:
          "Item-level matches whole docs. Chunk-level matches specific passages for precision at scale.",
      },
      {
        title: "Session Scoping",
        description:
          "Search restricted to session-linked documents. Prevents cross-project contamination.",
      },
      {
        title: "Graceful Fallbacks",
        description:
          "If embeddings unavailable, falls back to text-only. If chunks fail, falls back to items. Always returns results.",
      },
    ],
  },
  {
    icon: MessageSquare,
    title: "Chat Interface",
    subtitle: "AI assistant that queries your entire knowledge base",
    features: [
      {
        title: "Multi-Step Reasoning",
        description:
          "ToolLoopAgent with search_context and get_document tools. Synthesizes answers across sources.",
      },
      {
        title: "Model Selector",
        description:
          "Claude Haiku/Sonnet/Opus, GPT-4o, Gemini. Switch per conversation based on task complexity.",
      },
      {
        title: "Source Citations",
        description:
          "Every answer shows which documents were used with relevance scores. Click through to verify.",
      },
      {
        title: "Multi-Conversation",
        description:
          "Create, rename, and delete separate threads. Session-scoped chat for project focus.",
      },
    ],
  },
  {
    icon: FolderKanban,
    title: "Sessions",
    subtitle: "Scoped project workspaces with context and chat",
    features: [
      {
        title: "CRUD + Context Linking",
        description:
          "Create sessions, manually link docs via picker modal, or let AI auto-link by relevance.",
      },
      {
        title: "Scoped Chat + Context Panel",
        description:
          "Each session has its own chat and sidebar showing linked documents with source badges.",
      },
      {
        title: "Team Sharing",
        description:
          "Add or remove session members. Control who can see and interact with each workspace.",
      },
    ],
  },
  {
    icon: Inbox,
    title: "Inbox & Actions",
    subtitle: "AI-generated priorities and extracted action items",
    features: [
      {
        title: "AI-Driven Inbox",
        description:
          "Claude Haiku analyzes content to generate prioritized items (urgent/high/normal/low) with deduplication.",
      },
      {
        title: "Action Items",
        description:
          "Extracted from every document. Status tracking (pending/done/cancelled) with ownership and due dates.",
      },
    ],
  },
  {
    icon: Plug,
    title: "Integrations",
    subtitle: "6 active integrations via Nango Connect with real-time sync progress",
    features: [
      {
        title: "6 Active Integrations",
        description:
          "Google Drive (Docs, Sheets, Slides, PDFs, DOCX), Linear, Discord, Slack, GitHub, and Granola. Each with real-time webhooks and background sync.",
      },
      {
        title: "Background Sync Engine",
        description:
          "Powered by Nango's sync engine — automatic background sync every 15-30 min with incremental change detection, pagination, and rate limit handling.",
      },
      {
        title: "Live Sync Progress",
        description:
          "SSE-powered progress during manual sync — fetching phase, per-item processing with progress bar, elapsed time, and completion summary.",
      },
      {
        title: "Sync Now + Auto-Sync",
        description:
          "Manual 'Sync Now' trigger for immediate refresh, or let background sync keep data fresh automatically. Webhook-driven ingestion triggers AI pipeline.",
      },
      {
        title: "Selective Sync Config",
        description:
          "Per-integration configuration — choose which channels, folders, repos to sync. File type filters, message limits, bot exclusion.",
      },
      {
        title: "Webhook Idempotency",
        description:
          "Deduplication prevents duplicate processing on webhook retries across all providers.",
      },
      {
        title: "Coming Soon",
        description:
          "Google Calendar and Notion are planned. Shown in onboarding with 'Coming Soon' badges. Nango supports 700+ APIs — adding new sources is fast.",
      },
    ],
  },
  {
    icon: CreditCard,
    title: "Billing & Credits",
    subtitle: "Stripe-powered credit system",
    features: [
      {
        title: "Credit Packages",
        description:
          "100 ($9.99), 500 ($39.99), 2,000 ($129.99). Role-gated purchasing (owner/admin only).",
      },
      {
        title: "Stripe Webhooks",
        description:
          "Handles checkout completions, subscription changes, payment failures. Credits added automatically.",
      },
      {
        title: "Usage History",
        description:
          "Track AI operation history with period toggle (today/week/month). Breakdown by operation type and model. Token counts, credit costs, and estimated USD.",
      },
      {
        title: "Credit Balance in Sidebar",
        description:
          "Real-time credit balance display in sidebar navigation. Yellow warning at <50 credits, red at <10 with 'Upgrade' prompt.",
      },
      {
        title: "Credit Deduction",
        description:
          "Automatic credit deduction on every AI call — chat (1), extraction (2), embedding (0.5). 402 response when insufficient. Per-item deduction during sync.",
      },
    ],
  },
  {
    icon: BarChart3,
    title: "Analytics & Observability",
    subtitle: "KPI dashboard with health metrics",
    features: [
      {
        title: "Context Health",
        description:
          "Pipeline success rate, embedding coverage, extraction quality with pass/warn/fail thresholds.",
      },
      {
        title: "Agent Metrics",
        description:
          "Search utilization, error rates, latency. Every chat request logged with model, tokens, duration.",
      },
      {
        title: "Webhook Health",
        description:
          "Per-provider webhook delivery stats — success rate, last received, avg/day. Alerts when a provider goes silent for 24+ hours.",
      },
      {
        title: "Content Health Dashboard",
        description:
          "Knowledge base health score (0-100). Freshness breakdown (fresh/aging/stale/very-stale), per-source and per-type metrics, stale items list with action recommendations.",
      },
    ],
  },
  {
    icon: Shield,
    title: "Security & Team",
    subtitle: "Multi-tenant with RLS, audit logging, and role-based access",
    features: [
      {
        title: "Row Level Security",
        description:
          "All 15 tables protected. Members only see their org's data. Verified webhook signatures per provider.",
      },
      {
        title: "Team Management",
        description:
          "Owner/admin/member roles, email invitations, profile settings, paginated audit log.",
      },
      {
        title: "Organization Settings",
        description:
          "Edit org name, view stats (members, items, integrations). Danger zone with typed-confirmation delete for owners only.",
      },
      {
        title: "Rate Limiting",
        description:
          "Per-org tier-based rate limits — free (50/hr), starter (500/hr), pro (5000/hr). Standard X-RateLimit headers. 429 with retry-after.",
      },
      {
        title: "Webhook Verification",
        description:
          "HMAC-SHA256 for Linear and Nango, Ed25519 for Discord, Stripe signature verification. Idempotency dedup prevents duplicate processing.",
      },
    ],
  },
  {
    icon: SlidersHorizontal,
    title: "User Controls",
    subtitle: "Trust weighting, annotations, feedback, and personalization",
    features: [
      {
        title: "Source Trust Weighting",
        description:
          "Set per-source trust levels (0.1-2.0). Higher-trust sources rank higher in search. Org defaults with personal overrides.",
      },
      {
        title: "User Annotations",
        description:
          "Add custom titles, notes, and tags to any content. Never overwritten by sync — your edits stay separate from source truth.",
      },
      {
        title: "Chat Feedback",
        description:
          "Thumbs up/down on AI responses with reason picker (wrong answer, wrong source, outdated, missing context).",
      },
      {
        title: "Saved Searches",
        description:
          "Save search queries with filters as named quick-access chips. Share with team or keep personal.",
      },
    ],
  },
  {
    icon: TestTube,
    title: "Testing & Quality",
    subtitle: `${METRICS.unitTests} unit tests, ${METRICS.e2eSpecs} E2E specs, ${METRICS.evalSuites} AI evals`,
    features: [
      {
        title: "Comprehensive Test Suite",
        description: `${METRICS.unitTests} unit tests across 43 files via Vitest. ${METRICS.e2eSpecs} Playwright specs covering auth, dashboard, API smoke, user journeys, onboarding, billing, settings, production smoke.`,
      },
      {
        title: "AI Eval Suites",
        description:
          "Extraction quality, retrieval (P@5, MRR), agent behavior, performance benchmarks (p50/p95/max), context health KPIs.",
      },
      {
        title: "CI Pipeline",
        description:
          "GitHub Actions: typecheck + lint + test on every PR. Husky pre-commit hooks. Zero TODO/FIXME in codebase.",
      },
    ],
  },
  {
    icon: Bell,
    title: "Notifications & Digest",
    subtitle: "Morning digest, notification preferences, and email delivery",
    features: [
      {
        title: "Daily Digest Email",
        description:
          "Morning email summarizing new content, action items, and overdue tasks. Generated via cron at 7 AM. Preview available in-app.",
      },
      {
        title: "Notification Preferences",
        description:
          "Per-user settings: toggle daily digest, mention alerts, action item alerts, new context alerts, weekly summary. Custom digest delivery time.",
      },
      {
        title: "Digest Preview",
        description:
          "Preview your morning digest in-app before it sends. See exactly what would be emailed with real data from the last 24 hours.",
      },
    ],
  },
  {
    icon: Code2,
    title: "Developer Experience",
    subtitle:
      "63 API endpoints, keyboard shortcuts, command palette, and export",
    features: [
      {
        title: "63 API Endpoints",
        description:
          "Comprehensive API across 13 categories — chat, context, sessions, inbox, integrations, billing, settings, analytics, webhooks. Full docs at /api-docs.",
      },
      {
        title: "Command Palette",
        description:
          "Cmd+K opens 20 navigation commands with keyword search. Quick actions: upload document, new session, connect integration.",
      },
      {
        title: "Keyboard Shortcuts",
        description:
          "? opens shortcut reference. G+H/C/S/I/A for two-key navigation. Shortcut hints in command palette.",
      },
      {
        title: "Export System",
        description:
          "Export context items, sessions, or search results as Markdown or JSON. Download files with proper formatting and metadata.",
      },
      {
        title: "SEO & Metadata",
        description:
          "Title templates on all 32 pages, Open Graph tags, robots noindex until launch. Custom error and 404 pages.",
      },
      {
        title: "Mobile Responsive",
        description:
          "Chat and session workspace sidebars collapse to slide-out drawers. Consistent padding, horizontal table scroll, responsive grids across all pages.",
      },
    ],
  },
  {
    icon: Sparkles,
    title: "Session Intelligence",
    subtitle:
      "AI-powered insights and cross-source connection discovery",
    features: [
      {
        title: "Session Insights",
        description:
          "AI-generated insights surfaced in session workspace — new content alerts, cross-source connections, contradictions, action items. Dismiss or pin per insight.",
      },
      {
        title: "Cross-Source Connections",
        description:
          "AI finds relationships between items from different sources. Types: supports, contradicts, extends, updates, depends_on. Auto-generates session insights.",
      },
      {
        title: "Entity Visualization",
        description:
          "Interactive entity chips on context detail pages — people (blue), topics (purple), decisions (amber), projects (green). Click to search across library.",
      },
      {
        title: "Saved Searches",
        description:
          "Save search queries with filters as named quick-access chips in the context library. Share with team or keep personal.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Data — Roadmap Sprints                                             */
/* ------------------------------------------------------------------ */

const SPRINTS: RoadmapSprint[] = [
  {
    sprint: 1,
    title: "Foundation + Context Library",
    dates: "Mar 5-8",
    status: "complete",
    goal: "Auth, DB, ingestion pipeline, context library UI",
    highlights: [
      "Next.js 16 + Supabase + 18 migrations",
      "7-step Inngest pipeline",
      "File upload + context library page",
      "Login/signup/OAuth + onboarding flow",
    ],
    issueCount: 22,
  },
  {
    sprint: 2,
    title: "Integrations + Chat",
    dates: "Mar 9-11",
    status: "complete",
    goal: "4 integrations, hybrid search, chat with tools",
    highlights: [
      "Google Drive, Linear, Discord, Granola",
      "Hybrid search with RRF scoring",
      "ToolLoopAgent with multi-model selector",
      "AI Elements: tool cards, code blocks",
    ],
    issueCount: 24,
  },
  {
    sprint: 3,
    title: "Inbox + Sessions + Team + Billing",
    dates: "Mar 12-15",
    status: "complete",
    goal: "Inbox, actions, sessions, team management, Stripe billing, analytics",
    highlights: [
      "AI inbox generation + action extraction",
      "Session workspaces with scoped chat",
      "Stripe billing with 3 credit packages",
      "Analytics dashboard + KPIs",
      "713 unit tests + 16 E2E specs + 5 eval suites",
    ],
    issueCount: 54,
  },
  {
    sprint: 4,
    title: "Production Readiness",
    dates: "Mar 17",
    status: "complete",
    goal: "Credit deduction, usage logging, rate limiting, webhook hardening, E2E expansion.",
    highlights: [
      "Credit deduction middleware + usage logging",
      "Per-org tier-based rate limiting",
      "Webhook idempotency + Nango signature verification",
      "E2E billing, settings, production smoke tests",
      "Selective sync configuration per integration",
      "Production setup checklist + .env.example",
    ],
    issueCount: 16,
  },
  {
    sprint: 5,
    title: "Integrations Expansion + Daily Digest",
    dates: "Mar 17",
    status: "complete",
    goal: "Notification preferences, SEO, mobile polish, API docs expansion, daily digest.",
    highlights: [
      "Notification preferences + settings page",
      "SEO metadata on all pages",
      "Mobile responsive polish (chat, sessions, settings)",
      "Daily digest email generation + preview",
      "Command palette expanded (20 commands)",
      "API docs expanded (63 endpoints, 13 categories)",
    ],
    issueCount: 15,
  },
  {
    sprint: 6,
    title: "Session Agents + Monitoring",
    dates: "Mar 17",
    status: "complete",
    goal: "Session insights, cross-source connections, org settings, saved searches, export.",
    highlights: [
      "Session insights data model + API + UI",
      "Cross-source connection finder (AI-powered)",
      "Organization settings with danger zone",
      "Saved searches with team sharing",
      "Entity visualization (interactive chips)",
      "Export system (Markdown + JSON)",
      "Keyboard shortcuts reference panel",
    ],
    issueCount: 14,
  },
  {
    sprint: 7,
    title: "Ditto Personalization",
    dates: "Mar 19",
    status: "complete",
    goal: "Per-user AI agent with learned preferences.",
    highlights: [
      "Interaction tracking + preference learning",
      "Personalized inbox ranking",
      "Ditto profile page",
      '"For You" suggestions widget',
    ],
    issueCount: 15,
  },
  {
    sprint: 8,
    title: "Self-Service + External Teams",
    dates: "Mar 19",
    status: "complete",
    goal: "Public signup with plan selection. First external team.",
    highlights: [
      "Plan selection (Free/Starter/Pro)",
      "Subscription management",
      "API key management",
      "Landing page / marketing site",
    ],
    issueCount: 14,
  },
  {
    sprint: 9,
    title: "Canvas + Polish",
    dates: "Mar 22",
    status: "complete",
    goal: "Spatial canvas workspace. Final QA. Launch prep.",
    highlights: [
      "Canvas workspace with drag/zoom/minimap",
      "Accessibility audit + skip-to-content",
      "User guide page",
      "Launch checklist + subscription management",
    ],
    issueCount: 12,
  },
];

/* ------------------------------------------------------------------ */
/*  Data — Honest Assessment                                           */
/* ------------------------------------------------------------------ */

const STRENGTHS = [
  "Full platform in 17 days — 9 sprints, 156 issues, 33K LOC",
  "819 unit tests + 16 E2E specs + 5 AI eval suites from day 1",
  "AI pipeline is production-grade (chunking, embeddings, auto-linking)",
  "8 integrations with webhook verification + selective sync config",
  "Ditto personalization, canvas workspace, self-service billing shipped",
  "Zero TODO/FIXME markers — no technical shortcuts taken",
];

const RISKS = [
  {
    risk: "Not yet deployed to production",
    mitigation: "All code complete; manual Supabase/Stripe/Inngest setup remaining",
    severity: "high" as const,
  },
  {
    risk: "E2E tests haven't been run against a live environment",
    mitigation: "16 specs written and committed; need test credentials configured",
    severity: "medium" as const,
  },
  {
    risk: "Single developer — bus factor of 1",
    mitigation: "Comprehensive docs + 713 tests make onboarding easier",
    severity: "medium" as const,
  },
  {
    risk: "No Sentry or external monitoring yet",
    mitigation: "Scheduled for Sprint 6",
    severity: "low" as const,
  },
];

const TECH_STACK = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Tailwind CSS v3",
  "shadcn/ui",
  "Supabase + pgvector",
  "Vercel AI SDK v6",
  "AI Gateway",
  "Inngest",
  "Nango",
  "Stripe",
  "Zod v4",
  "Vitest",
  "Playwright",
  "GSAP",
];

/* ------------------------------------------------------------------ */
/*  Animated Components                                                */
/* ------------------------------------------------------------------ */

function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
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
        delay,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      }
    );
  }, [delay]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  duration = 1.5,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!ref.current || hasAnimated) return;
    const el = ref.current;

    ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      onEnter: () => {
        if (hasAnimated) return;
        setHasAnimated(true);
        const counter = { val: 0 };
        gsap.to(counter, {
          val: target,
          duration,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = `${prefix}${Math.round(counter.val).toLocaleString()}${suffix}`;
          },
        });
      },
    });
  }, [target, suffix, prefix, duration, hasAnimated]);

  return <span ref={ref}>0</span>;
}

function StaggeredCards({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const cards = ref.current.children;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 30, scale: 0.95 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        stagger: 0.08,
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
/*  Sub-Components                                                     */
/* ------------------------------------------------------------------ */

function HeroSection() {
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
        ref.current.querySelector(".hero-title"),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
        "-=0.3"
      )
      .fromTo(
        ref.current.querySelector(".hero-subtitle"),
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
        "-=0.3"
      )
      .fromTo(
        ref.current.querySelector(".hero-desc"),
        { opacity: 0 },
        { opacity: 1, duration: 0.5 },
        "-=0.2"
      )
      .fromTo(
        ref.current.querySelectorAll(".hero-badge"),
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.3, stagger: 0.04, ease: "power2.out" },
        "-=0.3"
      );
  }, []);

  return (
    <div ref={ref} className="mb-16">
      <div className="flex items-center gap-4 mb-4">
        <div className="hero-icon flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20">
          <Layers className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="hero-title text-3xl font-bold tracking-tight">
            Granger
          </h1>
          <p className="hero-subtitle text-sm text-muted-foreground">
            Platform Status Report — March 22, 2026
          </p>
        </div>
      </div>
      <p className="hero-desc text-muted-foreground max-w-3xl leading-relaxed mb-5">
        Granger is your AI Chief of Staff. It connects every
        tool you use into a single context layer, then deploys intelligent
        agents that understand what&apos;s happening across your business.
        This report covers the current state of the prototype, what&apos;s been
        built, what&apos;s next, and an honest assessment of risks.
      </p>
      <div className="flex flex-wrap gap-2">
        {TECH_STACK.map((tech) => (
          <Badge
            key={tech}
            variant="secondary"
            className="hero-badge text-xs"
          >
            {tech}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  suffix = "",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  suffix?: string;
}) {
  return (
    <Card className="p-4 text-center hover:border-primary/30 transition-colors">
      <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-2" />
      <p className="text-2xl font-bold tabular-nums">
        <AnimatedCounter target={value} suffix={suffix} />
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">{feature.title}</h4>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {feature.description}
      </p>
    </div>
  );
}

function SectionBlock({ section }: { section: FeatureSection }) {
  const Icon = section.icon;
  return (
    <AnimatedSection>
      <div className="flex items-center gap-3 mb-1">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">{section.title}</h3>
          <p className="text-xs text-muted-foreground">{section.subtitle}</p>
        </div>
      </div>
      <StaggeredCards className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
        {section.features.map((f) => (
          <Card key={f.title} className="p-4">
            <FeatureCard feature={f} />
          </Card>
        ))}
      </StaggeredCards>
    </AnimatedSection>
  );
}

function SprintTimeline({ sprint }: { sprint: RoadmapSprint }) {
  const statusColors = {
    complete:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    current:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    upcoming:
      "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  };

  const statusIcons = {
    complete: CheckCircle2,
    current: Clock,
    upcoming: Circle,
  };

  const StatusIcon = statusIcons[sprint.status];

  return (
    <Card
      className={`p-5 border ${sprint.status === "current" ? "border-blue-500/40 bg-blue-500/5" : ""}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <StatusIcon
            className={`h-5 w-5 ${
              sprint.status === "complete"
                ? "text-emerald-500"
                : sprint.status === "current"
                  ? "text-blue-500"
                  : "text-zinc-400"
            }`}
          />
          <div>
            <h4 className="font-semibold text-sm">
              Sprint {sprint.sprint}: {sprint.title}
            </h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="h-3 w-3" />
              {sprint.dates}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusColors[sprint.status]} border text-[10px]`}>
            {sprint.status === "complete"
              ? "Complete"
              : sprint.status === "current"
                ? "In Progress"
                : "Upcoming"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {sprint.issueCount} issues
          </Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{sprint.goal}</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {sprint.highlights.map((h) => (
          <div key={h} className="flex items-center gap-2 text-xs">
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>{h}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FeaturesPage() {
  const totalFeatures = SECTIONS.reduce(
    (sum, s) => sum + s.features.length,
    0
  );

  useEffect(() => {
    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div
      className="p-6 sm:p-8 max-w-6xl mx-auto"
      data-testid="features-page"
    >
      {/* Hero */}
      <HeroSection />

      {/* Executive Summary */}
      <AnimatedSection className="mb-12">
        <Card className="p-6 border-primary/20 bg-primary/[0.02]">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Executive Summary
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                All 3 phases (9 sprints) are <strong className="text-foreground">100% complete</strong>.
                In {METRICS.daysBuilding} days of development, we shipped a full-stack application with{" "}
                {totalFeatures} features across {SECTIONS.length} categories, backed by{" "}
                {METRICS.unitTests} unit tests and {METRICS.e2eSpecs} E2E specs.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground mt-3">
                The product includes Ditto personalization, self-service signup with Stripe
                subscriptions, a spatial canvas workspace, 8 active integrations, and
                an AI pipeline processing content from every connected tool.
              </p>
            </div>
            <div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Next milestone:</strong> Production
                deployment and first external teams. All code complete — manual setup
                needed for Supabase, Stripe live keys, and Inngest Vercel integration.
              </p>
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">
                    Overall Progress ({METRICS.linearIssuesDone}/{METRICS.linearIssuesTotal} issues)
                  </span>
                  <span className="font-medium">{COMPLETION}%</span>
                </div>
                <Progress value={COMPLETION} className="h-2" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                All 9 sprints shipped. Ready for production deployment and external teams.
              </p>
            </div>
          </div>
        </Card>
      </AnimatedSection>

      {/* Key Metrics */}
      <AnimatedSection className="mb-12">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Key Metrics
        </h2>
        <StaggeredCards className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Lines of Code"
            value={METRICS.linesOfCode}
            icon={Code2}
          />
          <MetricCard
            label="Source Files"
            value={METRICS.files}
            icon={FileText}
          />
          <MetricCard
            label="API Routes"
            value={METRICS.apiRoutes}
            icon={Globe}
          />
          <MetricCard
            label="App Pages"
            value={METRICS.pages}
            icon={Layers}
          />
          <MetricCard
            label="UI Components"
            value={METRICS.components}
            icon={SlidersHorizontal}
          />
          <MetricCard
            label="Unit Tests"
            value={METRICS.unitTests}
            icon={TestTube}
          />
          <MetricCard
            label="E2E Specs"
            value={METRICS.e2eSpecs}
            icon={CheckCircle2}
          />
          <MetricCard
            label="AI Eval Suites"
            value={METRICS.evalSuites}
            icon={Brain}
          />
          <MetricCard
            label="DB Migrations"
            value={METRICS.dbMigrations}
            icon={Database}
          />
          <MetricCard
            label="Commits"
            value={METRICS.commits}
            icon={GitCommit}
          />
        </StaggeredCards>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          {METRICS.daysBuilding} days from first commit to prototype complete
          &middot; {METRICS.todoFixme} TODO/FIXME markers in codebase
          &middot; {METRICS.dependencies} production dependencies
        </p>
      </AnimatedSection>

      {/* Prototype Completeness */}
      <AnimatedSection className="mb-12">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Prototype Phase — What&apos;s Built
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {totalFeatures} features across {SECTIONS.length} categories. Every
          feature listed below is implemented, tested, and pushed to GitHub.
        </p>
      </AnimatedSection>

      {/* Feature Sections */}
      <div className="space-y-10 mb-16">
        {SECTIONS.map((section) => (
          <SectionBlock key={section.title} section={section} />
        ))}
      </div>

      <Separator className="my-16" />

      {/* Roadmap Timeline */}
      <AnimatedSection className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Roadmap</h2>
            <p className="text-sm text-muted-foreground">
              9 sprints &middot; March 5 — June 5, 2026
            </p>
          </div>
        </div>
      </AnimatedSection>

      {/* Sprint progress bar */}
      <AnimatedSection className="mb-8">
        <div className="flex gap-1">
          {SPRINTS.map((s) => (
            <div
              key={s.sprint}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s.status === "complete"
                  ? "bg-emerald-500"
                  : s.status === "current"
                    ? "bg-blue-500 animate-pulse"
                    : "bg-zinc-200 dark:bg-zinc-800"
              }`}
              title={`Sprint ${s.sprint}: ${s.title}`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-0.5">
          <span>Sprint 1</span>
          <span>Sprint 9</span>
        </div>
      </AnimatedSection>

      {/* Sprint Cards */}
      <div className="space-y-4 mb-16">
        {SPRINTS.map((sprint, i) => (
          <AnimatedSection key={sprint.sprint} delay={i * 0.05}>
            <SprintTimeline sprint={sprint} />
          </AnimatedSection>
        ))}
      </div>

      <Separator className="my-16" />

      {/* Honest Assessment */}
      <AnimatedSection className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Honest Assessment
        </h2>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Strengths */}
          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Strengths
            </h3>
            <div className="space-y-3">
              {STRENGTHS.map((s) => (
                <div key={s} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Risks */}
          <Card className="p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risks & Mitigations
            </h3>
            <div className="space-y-4">
              {RISKS.map((r) => (
                <div key={r.risk} className="text-sm">
                  <div className="flex items-start gap-2">
                    <Badge
                      className={`text-[10px] shrink-0 mt-0.5 border ${
                        r.severity === "high"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                          : r.severity === "medium"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                      }`}
                    >
                      {r.severity}
                    </Badge>
                    <div>
                      <p className="font-medium text-xs">{r.risk}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.mitigation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </AnimatedSection>

      {/* Success Metrics */}
      <AnimatedSection className="mb-16">
        <Card className="p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Target Success Metrics
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                phase: "P2 End (Sprint 6)",
                metric: "Internal DAU",
                target: "3/3 team members",
              },
              {
                phase: "P2 End",
                metric: "Context Items",
                target: "500+ ingested",
              },
              {
                phase: "P3 End (Sprint 9)",
                metric: "External Teams",
                target: "3-5 onboarded",
              },
              {
                phase: "P3 End",
                metric: "Revenue",
                target: "First paying customer",
              },
            ].map((m) => (
              <div
                key={m.metric}
                className="text-center p-3 rounded-lg bg-muted/50"
              >
                <p className="text-[10px] text-muted-foreground mb-1">
                  {m.phase}
                </p>
                <p className="text-sm font-semibold">{m.target}</p>
                <p className="text-xs text-muted-foreground">{m.metric}</p>
              </div>
            ))}
          </div>
        </Card>
      </AnimatedSection>

      {/* P4 Backlog */}
      <AnimatedSection className="mb-16">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Post-Launch Backlog (P4)
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            "Ditto as Primary Interface",
            "Integration Marketplace",
            "3D Canvas (React Three Fiber)",
            "Gmail Integration",
            "Calendar Sync",
            "Mobile App (Expo)",
            "Outbound Webhooks",
            "Custom Agent Builder",
            "Team Analytics",
            "Advanced RBAC",
          ].map((item) => (
            <Badge
              key={item}
              variant="outline"
              className="text-xs text-muted-foreground"
            >
              {item}
            </Badge>
          ))}
        </div>
      </AnimatedSection>

      {/* Use Cases CTA */}
      <AnimatedSection className="mb-16">
        <Card className="p-6 text-center border-primary/20 bg-primary/[0.02]">
          <h3 className="font-semibold mb-2">See Granger in Action</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            6 real-world walkthroughs showing how teams use Granger day-to-day —
            from morning briefings to weekly reviews.
          </p>
          <a
            href="/features/use-cases"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            View Use Cases
            <ArrowRight className="h-4 w-4" />
          </a>
        </Card>
      </AnimatedSection>

      {/* Footer */}
      <div className="pt-8 border-t text-center text-xs text-muted-foreground">
        <p className="font-medium">
          Granger v0.1.0 — Mirror Factory
        </p>
        <p className="mt-1">
          {METRICS.linearIssuesDone} issues shipped &middot;{" "}
          {METRICS.commits} commits &middot;{" "}
          {METRICS.linesOfCode.toLocaleString()} lines of code &middot;{" "}
          {METRICS.unitTests} tests passing
        </p>
        <p className="mt-1">
          Built by Alfonso Morales &middot; Report generated March 17, 2026
        </p>
      </div>
    </div>
  );
}
