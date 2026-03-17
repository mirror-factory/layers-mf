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
  /** If set the sprint is collapsed and shows this description instead */
  archived?: string;
  archivedLink?: string;
  issues: Issue[];
}

const SPRINTS: Sprint[] = [
  {
    name: "Sprint 1-3 — Prototype (Archived in PROD-127)",
    archived: "All 70 issues archived. See PROD-127 for full list.",
    archivedLink: "https://linear.app/mirror-factory/issue/PROD-127",
    issues: [],
  },
  {
    name: "Sprint 4 — Production Readiness",
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
    name: "Sprint 5 — Integrations Expansion",
    issues: [
      { id: null, title: "Notification preferences + settings page", status: "Done", linearUrl: null },
      { id: null, title: "Daily digest email generation + preview", status: "Done", linearUrl: null },
      { id: null, title: "Command palette updated (20 commands)", status: "Done", linearUrl: null },
      { id: null, title: "API docs expanded (63 endpoints)", status: "Done", linearUrl: null },
      { id: null, title: "Webhook health dashboard", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Sprint 6 — Session Agents + Monitoring",
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
    name: "Context Engineering Architecture",
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
    name: "Integration Overhaul",
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
    name: "Super-Admin Platform",
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
    name: "Presentation",
    issues: [
      { id: null, title: "Features page (91 features, 16 categories, GSAP animations)", status: "Done", linearUrl: null },
      { id: null, title: "Use cases page (6 walkthroughs + data flow diagram)", status: "Done", linearUrl: null },
    ],
  },
  {
    name: "Sprint 7 — Ditto Personalization (Upcoming)",
    issues: [
      { id: "PROD-168", title: "Ditto personal AI agent", status: "Backlog", linearUrl: "https://linear.app/mirror-factory/issue/PROD-168" },
      { id: null, title: "User interaction tracking", status: "Planned", linearUrl: null },
      { id: null, title: "Preference vector computation", status: "Planned", linearUrl: null },
      { id: null, title: "Ditto profile generation (Inngest cron)", status: "Planned", linearUrl: null },
      { id: null, title: "Personalized inbox ranking", status: "Planned", linearUrl: null },
      { id: null, title: "Personalized search boost", status: "Planned", linearUrl: null },
      { id: null, title: "Ditto profile page (/ditto)", status: "Planned", linearUrl: null },
      { id: null, title: '"For You" suggestions widget', status: "Planned", linearUrl: null },
      { id: null, title: "Chat personality customization", status: "Planned", linearUrl: null },
      { id: null, title: "Privacy audit on interaction data", status: "Planned", linearUrl: null },
    ],
  },
  {
    name: "Sprint 8 — Self-Service (Upcoming)",
    issues: [
      { id: null, title: "Public signup with plan selection", status: "Planned", linearUrl: null },
      { id: null, title: "Subscription management API", status: "Planned", linearUrl: null },
      { id: null, title: "Monthly credit reset cron", status: "Planned", linearUrl: null },
      { id: null, title: "Organization settings API expansion", status: "Planned", linearUrl: null },
      { id: null, title: "API key management", status: "Planned", linearUrl: null },
      { id: null, title: "Plan selection page (Free/Starter/Pro)", status: "Planned", linearUrl: null },
      { id: null, title: "Landing page for unauthenticated users", status: "Planned", linearUrl: null },
    ],
  },
  {
    name: "Sprint 9 — Canvas + Polish (Upcoming)",
    issues: [
      { id: null, title: "Canvas data model + API", status: "Planned", linearUrl: null },
      { id: null, title: "Canvas workspace UI (drag/zoom)", status: "Planned", linearUrl: null },
      { id: null, title: "Export system — PDF support", status: "Planned", linearUrl: null },
      { id: null, title: "Final UX polish + accessibility", status: "Planned", linearUrl: null },
      { id: null, title: "User guide documentation", status: "Planned", linearUrl: null },
      { id: null, title: "Launch checklist", status: "Planned", linearUrl: null },
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
          All work items across Layers — Linear-tracked and untracked.
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
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Archive className="h-4 w-4 shrink-0" />
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
