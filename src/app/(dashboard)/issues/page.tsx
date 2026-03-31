import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Search,
  Archive,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Issue Tracker",
};

/* ------------------------------------------------------------------ */
/*  Static data                                                       */
/* ------------------------------------------------------------------ */

type Status = "Done" | "Backlog" | "Blocked" | "Planned";

interface Issue {
  id: string | null;
  title: string;
  status: Status;
  linearUrl: string | null;
}

interface Sprint {
  name: string;
  /** Summary of what the sprint covered */
  description?: string;
  /** If set the sprint is collapsed and shows this description instead */
  archived?: string;
  archivedLink?: string;
  issues: Issue[];
}

const SPRINTS: Sprint[] = [
  {
    name: "Sprint 1 — Foundation + Context Library (Mar 5-8)",
    description:
      "Built the entire foundation: Next.js 16 app with Supabase (18 migrations), full auth system (login, signup, OAuth, password reset), context library with file upload (PDF, DOCX, TXT, MD), 7-step Inngest AI pipeline (extract → chunk → embed → inbox → link), 4-step onboarding flow, and the core database schema (organizations, context_items with pgvector, sessions, inbox_items, action_items, audit_log).",
    archived: "22 issues archived in PROD-127.",
    archivedLink: "https://linear.app/mirror-factory/issue/PROD-127",
    issues: [],
  },
  {
    name: "Sprint 2 — Integrations + Chat (Mar 9-11)",
    description:
      "Connected 4 external tools via Nango: Google Drive (push notifications, incremental sync), Linear (GraphQL, HMAC webhooks), Discord (Ed25519 webhooks, message batching), and Granola (webhook daemon). Built the full chat interface with ToolLoopAgent, hybrid search (vector + full-text with RRF), multi-model selector (Haiku/Sonnet/Opus/GPT-4o/Gemini), source citations, tool call panels, and multi-conversation support with AI Elements UI.",
    archived: "24 issues archived in PROD-127.",
    archivedLink: "https://linear.app/mirror-factory/issue/PROD-127",
    issues: [],
  },
  {
    name: "Sprint 3 — Inbox + Sessions + Team + Billing + Testing (Mar 12-16)",
    description:
      "Shipped inbox (AI-driven prioritization, extraction-based items, deduplication), sessions (CRUD, scoped chat, auto-linking via AI), team management (roles, invitations, profile settings, audit log), Stripe billing (3 credit packages, webhooks), analytics dashboard (KPIs, agent metrics, context health), actions page, API docs, command palette, breadcrumbs, theme toggle, error boundaries, and a comprehensive testing overhaul — 492 unit tests, 13 E2E specs, 5 AI eval suites (extraction, retrieval, agent, performance, context health).",
    archived: "54 issues (including 11 testing epics + 18 sub-tasks) archived in PROD-127.",
    archivedLink: "https://linear.app/mirror-factory/issue/PROD-127",
    issues: [],
  },
  {
    name: "Sprint 4 — Production Readiness (Mar 17)",
    description:
      "Everything needed to go live: credit deduction middleware enforcing credits on every AI call (chat, extraction, embedding), usage logging tracking tokens/cost/credits per operation, per-org tier-based rate limiting (free 50/hr, starter 500, pro 5000) with standard headers, usage history UI with period toggle and model breakdown, webhook idempotency preventing duplicate processing across all providers, Nango HMAC signature verification, selective sync config letting users choose which channels/repos/folders to sync, production setup documentation with full checklist, and E2E tests for billing, settings, and all 32 pages.",
    issues: [
      { id: "PROD-222", title: "Credit deduction middleware", status: "Done", linearUrl: "https://linear.app/mirror-factory/issue/PROD-222" },
      { id: "PROD-223", title: "Usage logging on AI calls", status: "Done", linearUrl: "https://linear.app/mirror-factory/issue/PROD-223" },
      { id: "PROD-224", title: "Production Supabase migration", status: "Backlog", linearUrl: "https://linear.app/mirror-factory/issue/PROD-224" },
      { id: "PROD-225", title: "Stripe production configuration", status: "Backlog", linearUrl: "https://linear.app/mirror-factory/issue/PROD-225" },
      { id: "PROD-226", title: "Inngest production setup", status: "Backlog", linearUrl: "https://linear.app/mirror-factory/issue/PROD-226" },
      { id: "PROD-227", title: "Per-org tier-based rate limiting", status: "Done", linearUrl: "https://linear.app/mirror-factory/issue/PROD-227" },
      { id: "PROD-228", title: "Usage history UI in billing", status: "Done", linearUrl: "https://linear.app/mirror-factory/issue/PROD-228" },
      { id: null, title: "Webhook idempotency for all providers", status: "Done", linearUrl: null },
      { id: null, title: "Nango webhook HMAC verification", status: "Done", linearUrl: null },
      { id: null, title: "Selective sync config per integration", status: "Done", linearUrl: null },
      { id: null, title: "Production setup docs + .env.example", status: "Done", linearUrl: null },
      { id: null, title: "E2E billing, settings, production smoke tests", status: "Done", linearUrl: null },
      { id: null, title: "Vercel deployment + CI/CD", status: "Blocked", linearUrl: null },
      { id: null, title: "Mobile responsive polish", status: "Done", linearUrl: null },
      { id: null, title: "SEO + meta tags + OG images", status: "Done", linearUrl: null },
      { id: null, title: "Custom error/404 pages", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Sprint 5 — Integrations Expansion (Mar 17)",
    description:
      "Extended the platform with notification preferences (per-user toggles for digest, mentions, action items with time picker), daily digest email system (generation utility, HTML template, cron at 7 AM, in-app preview), SEO metadata on all 32 pages with OG tags, mobile responsive polish (chat and session sidebars become slide-out drawers, consistent padding across all settings pages, horizontal table scroll), custom error/404 pages, command palette expanded to 20 commands with keyword search, API docs expanded from ~30 to 63 endpoints across 13 categories, and webhook health dashboard showing per-provider delivery stats with silence alerts.",
    issues: [
      { id: null, title: "Notification preferences + settings page", status: "Done", linearUrl: null },
      { id: null, title: "Daily digest email generation + preview", status: "Done", linearUrl: null },
      { id: null, title: "Command palette updated (20 commands)", status: "Done", linearUrl: null },
      { id: null, title: "API docs expanded (63 endpoints)", status: "Done", linearUrl: null },
      { id: null, title: "Webhook health dashboard", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Sprint 6 — Session Agents + Monitoring (Mar 17)",
    description:
      "AI-powered session intelligence: session insights surface cross-source connections, contradictions, and new content alerts directly in the workspace sidebar. Cross-source connection finder uses AI to detect relationships between items from different tools (supports, contradicts, extends, updates, depends_on) and auto-generates insights. Also shipped org settings with danger zone delete, saved searches with team sharing and chip UI, interactive entity visualization (click people/topics/decisions to search), Markdown/JSON export on context detail, library, and session pages, and keyboard shortcuts panel with two-key navigation sequences.",
    issues: [
      { id: null, title: "Session insights data model + API + UI", status: "Done", linearUrl: null },
      { id: null, title: "Cross-source connection finder (AI)", status: "Done", linearUrl: null },
      { id: null, title: "Organization settings + danger zone", status: "Done", linearUrl: null },
      { id: null, title: "Saved searches with team sharing", status: "Done", linearUrl: null },
      { id: null, title: "Entity visualization (interactive chips)", status: "Done", linearUrl: null },
      { id: null, title: "Export system (Markdown + JSON)", status: "Done", linearUrl: null },
      { id: null, title: "Keyboard shortcuts reference panel", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Context Engineering Architecture (Mar 17)",
    description:
      "Fundamental rearchitecture of how Granger handles content. Phase 1: versioning schema with append-only history table (no embeddings stored = 80% storage savings), user overlay columns that sync never overwrites. Phase 2: SHA-256 content hashing with field-level diff — skips re-embedding on metadata-only changes, saving AI credits. Phase 3: weekly rolling windows for Slack/Discord messages — no more data loss on re-sync. Phase 4: source trust weighting (sliders 0.1-2.0), user annotations, chat feedback. Phase 5: multi-query expansion, trust-weighted ranking, freshness decay with content-type-specific half-lives. Phase 6: version history timeline UI, content health dashboard (0-100 score). Backed by 628-line architecture doc with diagrams.",
    issues: [
      { id: null, title: "Phase 1: Schema — versioning columns + versions table", status: "Done", linearUrl: null },
      { id: null, title: "Phase 2: Change detection — SHA-256 hashing + field diff", status: "Done", linearUrl: null },
      { id: null, title: "Phase 3: Message streams — weekly rolling windows", status: "Done", linearUrl: null },
      { id: null, title: "Phase 4: User controls — source trust + annotations + feedback", status: "Done", linearUrl: null },
      { id: null, title: "Phase 5: Advanced retrieval — query expansion + trust weighting + freshness", status: "Done", linearUrl: null },
      { id: null, title: "Phase 6: Lifecycle UI — version history + health dashboard", status: "Done", linearUrl: null },
      { id: null, title: "Architecture docs (context-engineering.md + diagrams.md)", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Integration Overhaul (Mar 17)",
    description:
      "Complete overhaul of the integration system. SSE streaming replaces the old spinner with real-time per-item progress bars and elapsed time. Google Drive expanded from 3 Google-native types to 8 (added PDFs via pdf-parse, DOCX via mammoth, XLSX, TXT, Markdown, CSV). Slack and GitHub limits significantly increased. Nango webhook handler rebuilt as primary ingestion path with 6 provider-specific data mappers and idempotent dedup. Background sync trigger API enables non-blocking sync. Integration catalog page documents every provider's content types, capabilities, and limits. Onboarding updated with all 6 active providers plus Coming Soon badges.",
    issues: [
      { id: null, title: "SSE streaming sync progress", status: "Done", linearUrl: null },
      { id: null, title: "Google Drive expanded (PDFs, DOCX, XLSX, TXT, MD, CSV)", status: "Done", linearUrl: null },
      { id: null, title: "Slack limits: 3→20 channels, 50→200 msgs", status: "Done", linearUrl: null },
      { id: null, title: "GitHub limits: 4→10 repos, 8→15 issues", status: "Done", linearUrl: null },
      { id: null, title: "Nango webhook handler as primary ingestion path", status: "Done", linearUrl: null },
      { id: null, title: "Background sync trigger API", status: "Done", linearUrl: null },
      { id: null, title: "Integration catalog page", status: "Done", linearUrl: null },
      { id: null, title: "Onboarding: Discord + Granola added, Calendar/Notion Coming Soon", status: "Done", linearUrl: null },
      { id: null, title: "Nango sync engine migration plan", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Super-Admin Platform (Mar 17)",
    description:
      "Platform-level configuration for the CTO. Model pricing table with actual costs from Vercel AI Gateway (30+ models). Credit configuration with editable USD-per-credit rate and profit margin slider (0-100%) with live preview showing cost vs revenue. Credit packages editor (add/remove tiers, set Stripe price IDs). Platform stats dashboard showing total orgs, users, items, credits used, and cost-vs-revenue breakdown. Dynamic credit costs read from DB with 5-minute cache — change pricing without code deploys. Nango CLI initialized with 6 pre-built integration templates ready to customize.",
    issues: [
      { id: null, title: "Platform config table (model pricing, credits, packages)", status: "Done", linearUrl: null },
      { id: null, title: "Admin config API (super-admin gated)", status: "Done", linearUrl: null },
      { id: null, title: "Platform stats API (usage, revenue, margins)", status: "Done", linearUrl: null },
      { id: null, title: "Admin settings page (4 tabs)", status: "Done", linearUrl: null },
      { id: null, title: "Dynamic credit costs from DB", status: "Done", linearUrl: null },
      { id: null, title: "Nango CLI initialized + 6 templates cloned", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Presentation (Mar 17)",
    description:
      "Board-ready presentation pages with GSAP scroll animations. Features page shows 91 features across 16 categories with animated counters, sprint timeline (9 sprints with progress bar), honest assessment (strengths + risks with severity), success metrics, and P4 backlog. Use cases page has 6 interactive walkthroughs with animated flow diagrams — morning briefing, cross-source search, sprint management, team onboarding, post-meeting pipeline, and weekly leadership review — plus an animated data flow diagram showing the full ingestion-to-retrieval pipeline.",
    issues: [
      { id: null, title: "Features page (91 features, 16 categories, GSAP animations)", status: "Done", linearUrl: null },
      { id: null, title: "Use cases page (6 walkthroughs + data flow diagram)", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Sprint 7 — Ditto Personalization (Mar 19)",
    description:
      "Each user gets a personal AI agent called Ditto that learns their preferences. Track what they search, click, and dismiss to build a preference vector. Weekly Inngest cron generates a Ditto profile (interests, working hours, communication style, priority topics). Profile influences inbox ranking and search boost — users who click Linear issues often see Linear content ranked higher. Ditto profile page shows learned preferences with manual override controls. 'For You' widget on the dashboard proactively suggests relevant content. Chat personality adapts to user preference (formal/casual, brief/detailed). Foundation already laid: trust weighting, annotations, and feedback signals are live.",
    issues: [
      { id: "PROD-168", title: "Ditto personal AI agent", status: "Done", linearUrl: "https://linear.app/mirror-factory/issue/PROD-168" },
      { id: null, title: "User interaction tracking", status: "Done", linearUrl: null },
      { id: null, title: "Preference vector computation", status: "Done", linearUrl: null },
      { id: null, title: "Ditto profile generation (Inngest cron)", status: "Done", linearUrl: null },
      { id: null, title: "Personalized inbox ranking", status: "Done", linearUrl: null },
      { id: null, title: "Personalized search boost", status: "Done", linearUrl: null },
      { id: null, title: "Ditto profile page (/ditto)", status: "Done", linearUrl: null },
      { id: null, title: '"For You" suggestions widget', status: "Done", linearUrl: null },
      { id: null, title: "Chat personality customization", status: "Done", linearUrl: null },
      { id: null, title: "Privacy audit on interaction data", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Sprint 8 — Self-Service + External Teams (Mar 19)",
    description:
      "Open Granger to external teams. Public signup flow with plan selection (Free: 50 credits/mo, Starter: 500, Pro: 5000). Stripe subscriptions with proration on plan changes. Monthly credit reset cron with carry-over (up to 2x monthly allocation). Organization settings expansion (slug, billing email, data export). API key management for programmatic access. Plan selection page with feature comparison table. Landing page for unauthenticated users with hero, feature highlights, and CTA. Success metric: first external team signs up and reaches active use within 48 hours.",
    issues: [
      { id: null, title: "Public signup with plan selection", status: "Done", linearUrl: null },
      { id: null, title: "Subscription management API", status: "Done", linearUrl: null },
      { id: null, title: "Monthly credit reset cron", status: "Done", linearUrl: null },
      { id: null, title: "Organization settings API expansion", status: "Done", linearUrl: null },
      { id: null, title: "API key management", status: "Done", linearUrl: null },
      { id: null, title: "Plan selection page (Free/Starter/Pro)", status: "Done", linearUrl: null },
      { id: null, title: "Landing page for unauthenticated users", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Sprint 9 — Canvas + Polish (Mar 22)",
    description:
      "Spatial canvas workspace for visual content exploration. Drag context items onto an infinite pan/zoom canvas, resize and reposition, draw connections between related items. AI auto-layout groups items by topic clusters using embedding similarity. PDF export for sharing. Final UX polish pass across every page (spacing, typography, color consistency). Accessibility audit (ARIA labels, focus management, contrast). Onboarding improvements based on user feedback. Comprehensive user guide documentation. Full regression E2E suite on production. Launch checklist (security audit, monitoring, backups, incident runbook). Target: 3-5 external teams actively using Granger.",
    issues: [
      { id: null, title: "Canvas data model + API", status: "Done", linearUrl: null },
      { id: null, title: "Canvas workspace UI (drag/zoom)", status: "Done", linearUrl: null },
      { id: null, title: "Export system — PDF support", status: "Done", linearUrl: null },
      { id: null, title: "Final UX polish + accessibility", status: "Done", linearUrl: null },
      { id: null, title: "User guide documentation (/guide page)", status: "Done", linearUrl: null },
      { id: null, title: "Launch checklist (docs/launch-checklist.md)", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Additional Shipped (Mar 22)",
    description:
      "Agent specialization templates, compound knowledge loop, new integrations, and infrastructure fixes shipped alongside Sprint 9.",
    issues: [
      { id: null, title: "Agent specialization templates (6 templates)", status: "Done", linearUrl: null },
      { id: null, title: "Compound knowledge loop (AI outputs → context items)", status: "Done", linearUrl: null },
      { id: null, title: "Google Calendar integration (active, 30-day window)", status: "Done", linearUrl: null },
      { id: null, title: "Notion integration (active, block-by-block content)", status: "Done", linearUrl: null },
      { id: null, title: "Multi-tenant webhook fix (workspace ID matching)", status: "Done", linearUrl: null },
      { id: null, title: "Canvas workspace with minimap", status: "Done", linearUrl: null },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const allIssues = SPRINTS.flatMap((s) => s.issues);
const archivedCount = 70; // Sprint 1-3
const totalCount = allIssues.length + archivedCount;
const doneCount = allIssues.filter((i) => i.status === "Done").length + archivedCount;
const blockedCount = allIssues.filter((i) => i.status === "Blocked").length;
const backlogCount = allIssues.filter((i) => i.status === "Backlog").length;
const plannedCount = allIssues.filter((i) => i.status === "Planned").length;
const untrackedCount = allIssues.filter((i) => !i.linearUrl).length;
const trackedCount = allIssues.filter((i) => i.linearUrl).length + archivedCount;

function statusBadge(status: Status) {
  switch (status) {
    case "Done":
      return (
        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/25 hover:bg-green-500/15 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Done
        </Badge>
      );
    case "Backlog":
      return (
        <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/15 gap-1">
          <Clock className="h-3 w-3" />
          Backlog
        </Badge>
      );
    case "Blocked":
      return (
        <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25 hover:bg-red-500/15 gap-1">
          <AlertTriangle className="h-3 w-3" />
          Blocked
        </Badge>
      );
    case "Planned":
      return (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <Circle className="h-3 w-3" />
          Planned
        </Badge>
      );
  }
}

function linearBadge(url: string | null) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Linear
      </a>
    );
  }
  return (
    <Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-400/50 bg-orange-500/5 hover:bg-orange-500/10 text-xs">
      Untracked
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter (client island)                                            */
/* ------------------------------------------------------------------ */

function IssueFilterBar() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Search className="h-4 w-4" />
      <span>Use Ctrl+F to search this page</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function IssuesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Issue Tracker</h1>
        <p className="text-muted-foreground text-sm mt-1">
          All work items across Granger — Linear-tracked and untracked.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Issues" value={totalCount} />
        <StatCard label="Done" value={doneCount} className="text-green-600 dark:text-green-400" />
        <StatCard label="Backlog" value={backlogCount} className="text-yellow-600 dark:text-yellow-400" />
        <StatCard label="Blocked" value={blockedCount} className="text-red-600 dark:text-red-400" />
        <StatCard label="Planned" value={plannedCount} className="text-muted-foreground" />
        <StatCard label="Untracked" value={untrackedCount} className="text-orange-600 dark:text-orange-400" />
      </div>

      {/* Tracking summary */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-muted-foreground">
          <strong className="text-foreground">{trackedCount}</strong> tracked on Linear
        </span>
        <span className="text-muted-foreground">
          <strong className="text-orange-600 dark:text-orange-400">{untrackedCount}</strong> not yet on Linear
        </span>
      </div>

      <IssueFilterBar />

      {/* Sprint sections */}
      {SPRINTS.map((sprint) => (
        <Card key={sprint.name}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{sprint.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {sprint.archived ? (
              <div className="space-y-3">
                {sprint.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {sprint.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
                  <Archive className="h-3.5 w-3.5 shrink-0" />
                  <span>{sprint.archived}</span>
                  {sprint.archivedLink && (
                    <a
                      href={sprint.archivedLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View on Linear
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium w-28">ID</th>
                      <th className="pb-2 pr-4 font-medium">Title</th>
                      <th className="pb-2 pr-4 font-medium w-28">Status</th>
                      <th className="pb-2 font-medium w-24">Tracking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sprint.issues.map((issue, idx) => (
                      <tr
                        key={`${issue.id ?? issue.title}-${idx}`}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                          {issue.id ?? <span className="text-muted-foreground/50">--</span>}
                        </td>
                        <td className="py-2.5 pr-4">{issue.title}</td>
                        <td className="py-2.5 pr-4">{statusBadge(issue.status)}</td>
                        <td className="py-2.5">{linearBadge(issue.linearUrl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                         */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${className ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
