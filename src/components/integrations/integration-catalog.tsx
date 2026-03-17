"use client";

import {
  Github,
  MessageSquare,
  FileText,
  BarChart3,
  Mic,
  Hash,
  HardDrive,
  Calendar,
  StickyNote,
  CheckCircle2,
  Circle,
  FileType,
  Globe,
  Webhook,
  RefreshCw,
  Search,
  Brain,
  Zap,
  Clock,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ContentType {
  format: string;
  description: string;
}

interface Capability {
  icon: LucideIcon;
  label: string;
}

interface ProviderInfo {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  status: "active" | "coming-soon";
  tagline: string;
  description: string;
  howItWorks: string[];
  contentTypes: ContentType[];
  capabilities: Capability[];
  syncMethod: string;
  limits: string;
  webhook: boolean;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const PROVIDERS: ProviderInfo[] = [
  {
    id: "google-drive",
    label: "Google Drive",
    icon: HardDrive,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    status: "active",
    tagline: "Documents, spreadsheets, presentations, and uploaded files",
    description:
      "Syncs your Google Workspace content and uploaded files into Layers. Content is exported as text, parsed, and processed through the AI pipeline for extraction, embedding, and search.",
    howItWorks: [
      "Connect via Google OAuth through Nango",
      "Layers queries your Drive for supported files",
      "Google-native files (Docs, Sheets, Slides) are exported as plain text",
      "Uploaded files (PDF, DOCX, XLSX) are downloaded and parsed",
      "Each file runs through the 7-step AI pipeline (extract → chunk → embed)",
      "Push notifications detect new changes within 24 hours",
    ],
    contentTypes: [
      { format: "Google Docs", description: "Exported as plain text — full document content including headings, tables, and formatting" },
      { format: "Google Sheets", description: "Exported as CSV — all cell data from the first sheet, preserving rows and columns" },
      { format: "Google Slides", description: "Exported as plain text — slide titles, bullet points, and speaker notes" },
      { format: "PDF", description: "Downloaded and parsed via pdf-parse — text extraction from all pages" },
      { format: "DOCX (Word)", description: "Downloaded and parsed via mammoth — full text with heading structure preserved" },
      { format: "XLSX (Excel)", description: "Downloaded and parsed — first sheet converted to CSV text" },
      { format: "TXT / Markdown", description: "Downloaded directly — raw text content used as-is" },
      { format: "CSV", description: "Downloaded directly — tabular data preserved as-is" },
    ],
    capabilities: [
      { icon: RefreshCw, label: "Incremental sync via Drive Changes API" },
      { icon: Webhook, label: "Push notifications with 24h watch channel renewal" },
      { icon: Search, label: "Full hybrid search across all synced documents" },
      { icon: Brain, label: "AI extraction: entities, summaries, action items" },
      { icon: Zap, label: "Auto-links new content to relevant sessions" },
    ],
    syncMethod: "OAuth via Nango → Drive API v3 → export/download → AI pipeline",
    limits: "Up to 100 files per sync, 12,000 chars per file, files under 30 chars skipped",
    webhook: true,
  },
  {
    id: "linear",
    label: "Linear",
    icon: BarChart3,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-500/10",
    status: "active",
    tagline: "Issues, projects, cycles, and comments",
    description:
      "Syncs your Linear workspace into Layers — issues with full metadata, project overviews, and cycle summaries. Great for keeping your AI assistant aware of engineering work.",
    howItWorks: [
      "Connect via Linear OAuth through Nango",
      "Layers fetches issues via GraphQL (including comments, assignees, labels)",
      "Projects and cycles are synced as separate context items",
      "Issue metadata (status, priority, assignee, labels) is embedded in the content",
      "Webhook receives real-time updates when issues change",
      "HMAC-SHA256 signature verification on all webhooks",
    ],
    contentTypes: [
      { format: "Issues", description: "Title, description, identifier (e.g. ENG-42), status, assignee, priority, labels, and embedded comments" },
      { format: "Projects", description: "Project name, description, progress percentage, lead, members, and target dates" },
      { format: "Cycles", description: "Cycle number, name, description, dates, progress, and team assignment" },
      { format: "Comments", description: "Embedded within their parent issue — author, body, and timestamps" },
    ],
    capabilities: [
      { icon: RefreshCw, label: "Incremental sync via updatedAt filter" },
      { icon: Webhook, label: "Real-time webhooks with HMAC-SHA256 verification" },
      { icon: Search, label: "Search across all issues, projects, and cycles" },
      { icon: Brain, label: "AI extracts action items and decisions from issues" },
      { icon: Shield, label: "Webhook signature verification prevents spoofing" },
    ],
    syncMethod: "OAuth via Nango → GraphQL API → paginated fetch → AI pipeline",
    limits: "Up to 500 issues (50/page, 10 pages), 12,000 chars per item",
    webhook: true,
  },
  {
    id: "slack",
    label: "Slack",
    icon: Hash,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-500/10",
    status: "active",
    tagline: "Public channel messages with author attribution",
    description:
      "Syncs recent messages from your Slack workspace. Messages are batched per channel with author names and timestamps, then processed by AI to extract decisions, action items, and key discussions.",
    howItWorks: [
      "Connect via Slack OAuth through Nango",
      "Layers fetches your public channels via conversations.list",
      "Recent messages are pulled from each channel via conversations.history",
      "Messages are batched per channel into a single document with timestamps",
      "Short messages (< 20 chars) and empty messages are filtered out",
      "Each channel batch runs through AI extraction",
    ],
    contentTypes: [
      { format: "Channel messages", description: "Batched per channel — each message includes timestamp and author username. Bot messages are filtered out." },
    ],
    capabilities: [
      { icon: RefreshCw, label: "Fetch up to 20 channels, 200 messages each" },
      { icon: Search, label: "Search across all synced channel messages" },
      { icon: Brain, label: "AI extracts decisions and action items from discussions" },
      { icon: Zap, label: "Auto-links channel content to relevant sessions" },
    ],
    syncMethod: "OAuth via Nango → Slack Web API → batch per channel → AI pipeline",
    limits: "Up to 20 public channels, 200 messages per channel, 12,000 chars per channel batch",
    webhook: false,
  },
  {
    id: "discord",
    label: "Discord",
    icon: MessageSquare,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-500/10",
    status: "active",
    tagline: "Server messages from text channels and threads",
    description:
      "Syncs messages from your Discord servers. Messages are grouped by channel with author attribution and chronological ordering. Bot messages are automatically filtered out.",
    howItWorks: [
      "Connect via Discord OAuth through Nango",
      "Layers discovers your guilds (servers) and their text channels",
      "Messages are fetched per channel with incremental cursor tracking",
      "Messages are batched chronologically with author names",
      "Bot messages and empty messages are filtered out",
      "Ed25519 signature verification on webhooks",
    ],
    contentTypes: [
      { format: "Text channel messages", description: "Messages from text channels (type 0), announcements (type 5), public/private threads (11, 12), and forum posts (15)" },
      { format: "Thread messages", description: "Thread context is preserved — includes parent message reference when available" },
    ],
    capabilities: [
      { icon: RefreshCw, label: "Incremental sync via per-channel message cursors" },
      { icon: Webhook, label: "Real-time webhooks with Ed25519 verification" },
      { icon: Search, label: "Search across all synced server messages" },
      { icon: Brain, label: "AI extracts key discussions and decisions" },
      { icon: Shield, label: "Ed25519 signature verification on all webhooks" },
    ],
    syncMethod: "OAuth via Nango → Discord API → batch per channel → AI pipeline",
    limits: "Up to 5 guilds, 10 channels per guild, 100 messages per channel, 12,000 chars per batch",
    webhook: true,
  },
  {
    id: "github",
    label: "GitHub",
    icon: Github,
    color: "text-gray-900 dark:text-gray-100",
    bgColor: "bg-gray-500/10",
    status: "active",
    tagline: "Repository issues with metadata",
    description:
      "Syncs issues from your GitHub repositories into Layers. Issues include titles, descriptions, labels, and state. Useful for keeping your AI aware of bugs, features, and technical discussions.",
    howItWorks: [
      "Connect via GitHub OAuth through Nango",
      "Layers fetches your most recently pushed repositories",
      "Issues (open and closed) are pulled from each repo with metadata",
      "Issue body text becomes the content, metadata is appended",
      "Issues without a body or with very short bodies are skipped",
      "Each issue runs through AI extraction",
    ],
    contentTypes: [
      { format: "Issues", description: "Issue title, body (Markdown), state (open/closed), labels, and repo context. Supports both regular and GitHub App connections." },
    ],
    capabilities: [
      { icon: RefreshCw, label: "Fetch up to 10 repos, 15 issues each" },
      { icon: Search, label: "Search across all synced repository issues" },
      { icon: Brain, label: "AI extracts action items and technical decisions" },
      { icon: Globe, label: "Supports both GitHub OAuth and GitHub App auth" },
    ],
    syncMethod: "OAuth via Nango → GitHub REST API → paginated fetch → AI pipeline",
    limits: "Up to 10 repos (sorted by last push), 15 issues per repo, 30 items total, 12,000 chars per issue",
    webhook: false,
  },
  {
    id: "granola",
    label: "Granola",
    icon: Mic,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    status: "active",
    tagline: "Meeting transcripts with attendee lists",
    description:
      "Syncs meeting transcripts from Granola — your AI meeting assistant. Transcripts include full conversation text and attendee metadata. Perfect for making past meetings searchable.",
    howItWorks: [
      "Connect via Granola auth through Nango, or receive webhooks directly",
      "Layers fetches meeting documents via the Granola API",
      "Transcripts include the full conversation text",
      "Attendee names and emails are extracted and appended",
      "Short transcripts (< 50 chars) are skipped",
      "Webhook daemon receives new transcripts in real-time",
    ],
    contentTypes: [
      { format: "Meeting transcripts", description: "Full conversation text with attendee list. Includes meeting title, date, and duration when available." },
    ],
    capabilities: [
      { icon: RefreshCw, label: "Pull sync via API + push via webhooks" },
      { icon: Webhook, label: "Webhook daemon with token verification" },
      { icon: Search, label: "Search across all meeting transcripts" },
      { icon: Brain, label: "AI extracts action items, decisions, and key topics" },
      { icon: Clock, label: "Attendee and timing metadata preserved" },
    ],
    syncMethod: "Token auth via Nango → Granola API + webhook receiver → AI pipeline",
    limits: "Up to 50 documents per sync, transcripts under 50 chars skipped, 12,000 chars per transcript",
    webhook: true,
  },
  {
    id: "google-calendar",
    label: "Google Calendar",
    icon: Calendar,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500/10",
    status: "coming-soon",
    tagline: "Meetings, events, and scheduling data",
    description:
      "Planned integration — will sync calendar events, meeting details, attendees, and scheduling information into Layers for full meeting context.",
    howItWorks: [
      "Will connect via Google OAuth (same as Drive)",
      "Sync upcoming and past events with attendees",
      "Link calendar events to meeting transcripts automatically",
      "Detect scheduling conflicts and surface them in inbox",
    ],
    contentTypes: [
      { format: "Calendar events", description: "Event title, description, attendees, time, location, and meeting links" },
    ],
    capabilities: [
      { icon: Clock, label: "Planned: event sync with attendee data" },
      { icon: Zap, label: "Planned: auto-link events to transcripts" },
    ],
    syncMethod: "Coming soon — Google Calendar API v3 via Nango",
    limits: "TBD",
    webhook: false,
  },
  {
    id: "notion",
    label: "Notion",
    icon: StickyNote,
    color: "text-stone-700 dark:text-stone-300",
    bgColor: "bg-stone-500/10",
    status: "coming-soon",
    tagline: "Pages, databases, and wiki content",
    description:
      "Planned integration — will sync Notion pages and database entries into Layers. Notion blocks will be converted to plain text for AI processing.",
    howItWorks: [
      "Will connect via Notion OAuth through Nango",
      "Sync pages and database entries with incremental change detection",
      "Convert Notion blocks to plain text for AI extraction",
      "Track last_edited_time for incremental syncing",
    ],
    contentTypes: [
      { format: "Pages", description: "Page content converted from Notion blocks to plain text — headings, paragraphs, lists, toggles, callouts" },
      { format: "Database entries", description: "Database row properties and page content combined" },
    ],
    capabilities: [
      { icon: RefreshCw, label: "Planned: incremental sync via last_edited_time" },
      { icon: Search, label: "Planned: full-text + semantic search across Notion content" },
    ],
    syncMethod: "Coming soon — Notion API via Nango",
    limits: "TBD",
    webhook: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function ProviderCard({
  provider,
  isConnected,
}: {
  provider: ProviderInfo;
  isConnected: boolean;
}) {
  const Icon = provider.icon;
  const isComingSoon = provider.status === "coming-soon";

  return (
    <Card
      className={`p-5 ${isComingSoon ? "opacity-70" : ""}`}
      data-testid={`catalog-${provider.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center h-10 w-10 rounded-xl ${provider.bgColor}`}
          >
            <Icon className={`h-5 w-5 ${provider.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{provider.label}</h3>
              {isConnected && (
                <Badge
                  variant="default"
                  className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                >
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                  Connected
                </Badge>
              )}
              {isComingSoon && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                >
                  Coming Soon
                </Badge>
              )}
              {provider.webhook && !isComingSoon && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                >
                  <Webhook className="h-2.5 w-2.5 mr-0.5" />
                  Webhooks
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {provider.tagline}
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        {provider.description}
      </p>

      {/* How it works */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          How it works
        </h4>
        <ol className="space-y-1.5">
          {provider.howItWorks.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground font-mono shrink-0 w-4 text-right">
                {i + 1}.
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Content types */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Content types
        </h4>
        <div className="space-y-2">
          {provider.contentTypes.map((ct) => (
            <div
              key={ct.format}
              className="flex items-start gap-2 text-xs rounded-md bg-muted/50 p-2.5"
            >
              <FileType className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">
                  {ct.format}
                </span>
                <span className="text-muted-foreground"> — {ct.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Capabilities
        </h4>
        <div className="flex flex-wrap gap-2">
          {provider.capabilities.map((cap) => {
            const CapIcon = cap.icon;
            return (
              <div
                key={cap.label}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1"
              >
                <CapIcon className="h-3 w-3 shrink-0" />
                <span>{cap.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Technical details */}
      <Separator className="my-3" />
      <div className="grid gap-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-start gap-2">
          <span className="font-medium text-foreground shrink-0 w-16">
            Sync
          </span>
          <span>{provider.syncMethod}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-medium text-foreground shrink-0 w-16">
            Limits
          </span>
          <span>{provider.limits}</span>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Export                                                              */
/* ------------------------------------------------------------------ */

export function IntegrationCatalog({
  connectedProviders,
}: {
  connectedProviders: Set<string>;
}) {
  const activeProviders = PROVIDERS.filter((p) => p.status === "active");
  const comingSoonProviders = PROVIDERS.filter(
    (p) => p.status === "coming-soon"
  );

  return (
    <div data-testid="integration-catalog">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Integration Catalog</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {activeProviders.length} active integrations, {comingSoonProviders.length} coming
          soon. Each integration syncs content through the AI pipeline — extraction,
          chunking, embedding, and auto-linking to sessions.
        </p>
      </div>

      <div className="space-y-6">
        {activeProviders.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            isConnected={
              connectedProviders.has(provider.id) ||
              (provider.id === "github" &&
                connectedProviders.has("github-app"))
            }
          />
        ))}
      </div>

      {comingSoonProviders.length > 0 && (
        <>
          <Separator className="my-8" />
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">
            Coming Soon
          </h3>
          <div className="space-y-6">
            {comingSoonProviders.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                isConnected={false}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-8 p-4 rounded-lg bg-muted/50 text-center">
        <p className="text-xs text-muted-foreground">
          All integrations use{" "}
          <span className="font-medium text-foreground">Nango</span> for OAuth
          credential management and API proxy. Nango supports 700+ APIs — new
          integrations can be added quickly.
        </p>
      </div>
    </div>
  );
}
