"use client";

import { useState, useMemo } from "react";
import { Search, Lock, Globe, Zap, FileCode2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  auth: "session" | "optional" | "cron-secret" | "webhook-secret" | "none";
  rateLimit?: string;
  params?: Record<string, string>;
  body?: Record<string, string>;
  response: string;
}

interface Category {
  label: string;
  value: string;
  endpoints: Endpoint[];
}

/* ------------------------------------------------------------------ */
/*  Endpoint data                                                     */
/* ------------------------------------------------------------------ */

const CATEGORIES: Category[] = [
  {
    label: "Chat",
    value: "chat",
    endpoints: [
      {
        method: "POST",
        path: "/api/chat",
        description:
          "Send a message and receive a streamed AI response with tool calling (search_context, get_document). Supports multi-model routing.",
        auth: "session",
        rateLimit: "10 req / 60s per user",
        body: {
          "messages (UIMessage[])": "Required. Array of chat messages.",
          "model? (string)": 'Optional model override. Defaults to "claude-haiku".',
          "conversationId? (string | null)": "Optional conversation to continue.",
        },
        response: "Server-Sent Event stream (AI response)",
      },
      {
        method: "POST",
        path: "/api/chat/feedback",
        description:
          "Submit feedback on an AI chat response. Logs to audit trail for quality monitoring.",
        auth: "session",
        body: {
          "messageId (string)": "Required. ID of the message to rate.",
          'feedback ("positive" | "negative")': "Required. Feedback type.",
          'reason? ("wrong_answer" | "wrong_source" | "outdated" | "missing_context")': "Optional reason for negative feedback.",
          "conversationId? (string)": "Optional conversation reference.",
        },
        response: "{ success: true }",
      },
      {
        method: "GET",
        path: "/api/chat/history",
        description: "Fetch chat message history for a session or conversation.",
        auth: "session",
        params: {
          "session_id | conversation_id": "One is required.",
        },
        response:
          '{ id, role: "user" | "assistant", parts: { type, text? }[], createdAt }[]',
      },
      {
        method: "POST",
        path: "/api/chat/session/[id]",
        description:
          "Chat within a specific session context. Scoped tools and context items.",
        auth: "session",
        rateLimit: "10 req / 60s per user",
        body: {
          "messages (UIMessage[])": "Required.",
          "model? (string)": "Optional model override.",
        },
        response: "Server-Sent Event stream",
      },
    ],
  },
  {
    label: "Conversations",
    value: "conversations",
    endpoints: [
      {
        method: "GET",
        path: "/api/conversations",
        description: "List all conversations for the authenticated user's organization.",
        auth: "session",
        response: "{ id, title, created_at, updated_at }[]",
      },
      {
        method: "POST",
        path: "/api/conversations",
        description: "Create a new conversation.",
        auth: "session",
        body: { "title? (string)": "Optional conversation title." },
        response: "{ id, title, created_at, updated_at } — 201",
      },
      {
        method: "GET",
        path: "/api/conversations/[id]",
        description: "Retrieve a single conversation by ID.",
        auth: "session",
        response: "{ id, title, created_at, updated_at }",
      },
      {
        method: "DELETE",
        path: "/api/conversations/[id]",
        description: "Delete a conversation.",
        auth: "session",
        response: "204 No Content",
      },
    ],
  },
  {
    label: "Context",
    value: "context",
    endpoints: [
      {
        method: "GET",
        path: "/api/context/[id]",
        description:
          "Fetch full context item details including raw content, entities, and processing status.",
        auth: "session",
        response:
          "{ id, title, description_short, description_long, source_type, source_id, content_type, raw_content, entities, status, ingested_at, processed_at }",
      },
      {
        method: "GET",
        path: "/api/context/[id]/annotations",
        description:
          "Get user annotations for a context item (custom title, notes, tags, trust weight).",
        auth: "session",
        response:
          "{ user_title, user_notes, user_tags: string[], trust_weight: number }",
      },
      {
        method: "PATCH",
        path: "/api/context/[id]/annotations",
        description:
          "Update user annotations on a context item. All fields optional.",
        auth: "session",
        body: {
          "user_title? (string | null)": "Custom title, max 200 chars.",
          "user_notes? (string | null)": "User notes, max 2000 chars.",
          "user_tags? (string[])": "Tags array, max 20 tags, each max 50 chars.",
          "trust_weight? (number)": "Weight between 0.1 and 2.0.",
        },
        response:
          "{ user_title, user_notes, user_tags: string[], trust_weight: number }",
      },
      {
        method: "GET",
        path: "/api/context/[id]/versions",
        description:
          "List version history for a context item, ordered by version number descending. Max 50.",
        auth: "session",
        response:
          "{ versions: { version_number, title, change_type, changed_fields, changed_by, created_at, content_preview }[], total }",
      },
      {
        method: "GET",
        path: "/api/context/[id]/versions/[num]",
        description:
          "Get a specific version of a context item with full content and metadata.",
        auth: "session",
        response:
          "{ version_number, title, raw_content, content_hash, source_metadata, change_type, changed_fields, changed_by, created_at, source_updated_at }",
      },
      {
        method: "DELETE",
        path: "/api/context/bulk",
        description: "Bulk delete context items by IDs.",
        auth: "session",
        body: { "ids (string[])": "Required. Non-empty array of context item UUIDs." },
        response: "{ deleted: number }",
      },
      {
        method: "GET",
        path: "/api/context/export",
        description: "Export all context items as JSON or CSV.",
        auth: "session",
        params: { 'format ("json" | "csv")': 'Default: "json".' },
        response: "JSON array or CSV file download",
      },
      {
        method: "POST",
        path: "/api/context/search",
        description:
          "Semantic + keyword hybrid search across context items using RRF scoring.",
        auth: "session",
        body: {
          "query (string)": "Required. Search query text.",
          "limit? (number)": "Results count, 1–50. Default 10.",
          "filters? (SearchFilters)": "Optional filters by source_type, content_type, etc.",
        },
        response:
          "{ results: { id, title, descriptionShort, sourceType, contentType, relevanceScore, sourceUrl }[] }",
      },
      {
        method: "POST",
        path: "/api/context/process",
        description:
          "Trigger AI extraction and embedding pipeline for a context item via Inngest.",
        auth: "session",
        body: {
          "contextItemId (string)": "Required. UUID of the context item to process.",
        },
        response: '{ contextItemId, status: "accepted" } — 202',
      },
    ],
  },
  {
    label: "Ingestion",
    value: "ingestion",
    endpoints: [
      {
        method: "POST",
        path: "/api/ingest/upload",
        description:
          "Upload a file (PDF, DOCX, TXT, etc.), extract text, embed, and create a context item. Max 10 MB.",
        auth: "session",
        rateLimit: "10 req / 60s per user",
        body: { "file (File)": "Multipart form field. Max 10 MB." },
        response: '{ id, status: "ready" | "error", error? }',
      },
    ],
  },
  {
    label: "Sessions",
    value: "sessions",
    endpoints: [
      {
        method: "GET",
        path: "/api/sessions",
        description: "List all sessions for the organization.",
        auth: "session",
        response:
          "{ id, name, goal, status, created_at, updated_at, last_agent_run }[]",
      },
      {
        method: "POST",
        path: "/api/sessions",
        description: "Create a new session.",
        auth: "session",
        body: {
          "name (string)": "Required. 1–200 characters.",
          "goal (string)": "Required. 1–2000 characters.",
        },
        response: "Session object — 201",
      },
      {
        method: "GET",
        path: "/api/sessions/[id]",
        description: "Retrieve a session with its linked context items.",
        auth: "session",
        response:
          "{ id, name, goal, status, agent_config, created_at, updated_at, last_agent_run, context_items: [...] }",
      },
      {
        method: "PATCH",
        path: "/api/sessions/[id]",
        description: "Update session name, goal, or status.",
        auth: "session",
        body: {
          "name? (string)": "1–200 characters.",
          "goal? (string)": "1–2000 characters.",
          'status? ("active" | "paused" | "archived")': "Session status.",
        },
        response: "Updated session object",
      },
      {
        method: "POST",
        path: "/api/sessions/[id]/context",
        description: "Link a context item to a session.",
        auth: "session",
        body: { "context_item_id (string)": "Required. UUID of context item." },
        response: "Link object — 201",
      },
      {
        method: "DELETE",
        path: "/api/sessions/[id]/context",
        description: "Unlink a context item from a session.",
        auth: "session",
        body: { "context_item_id (string)": "Required. UUID of context item." },
        response: "204 No Content",
      },
      {
        method: "GET",
        path: "/api/sessions/[id]/members",
        description: "List members of a session.",
        auth: "session",
        response: "{ id, user_id, email, role, joined_at }[]",
      },
      {
        method: "POST",
        path: "/api/sessions/[id]/members",
        description: "Add a member to a session.",
        auth: "session",
        body: { "user_id (string)": "Required. UUID of user to add." },
        response: "Member object — 201",
      },
    ],
  },
  {
    label: "Inbox",
    value: "inbox",
    endpoints: [
      {
        method: "GET",
        path: "/api/actions",
        description:
          "List action items extracted from context. Supports filtering by status and source type.",
        auth: "session",
        params: {
          'status? ("pending" | "done" | "cancelled")': "Filter by action status.",
          "sourceType? (string)": "Filter by source type.",
          "limit? (number)": "Max results, 1–200. Default 100.",
          "offset? (number)": "Pagination offset. Default 0.",
        },
        response:
          "{ contextItemId, actionIndex, text, status, sourceType, ... }[]",
      },
      {
        method: "PATCH",
        path: "/api/actions",
        description:
          "Update the status of a specific action item.",
        auth: "session",
        body: {
          "contextItemId (string)": "Required. UUID of the parent context item.",
          "actionIndex (number)": "Required. Index of the action item.",
          'status ("pending" | "done" | "cancelled")': "Required. New status.",
        },
        response: "{ ok: true }",
      },
      {
        method: "POST",
        path: "/api/inbox/generate",
        description:
          "Generate personalized inbox items for all users from the last 24 hours of context. Cron endpoint.",
        auth: "cron-secret",
        response: "{ generated: number, users: number, errors?: string[] }",
      },
    ],
  },
  {
    label: "Integrations",
    value: "integrations",
    endpoints: [
      {
        method: "GET",
        path: "/api/mcp-servers",
        description: "List all connected MCP servers for the organization.",
        auth: "session",
        response:
          "{ id, name, url, is_active, auth_type, last_connected_at, error_message, discovered_tools }[]",
      },
      {
        method: "POST",
        path: "/api/mcp-servers",
        description: "Add a new MCP server connection.",
        auth: "session",
        body: {
          "name (string)": "Server display name.",
          "url (string)": "Server URL.",
          "auth_type? (string)": '"oauth", "bearer", or "none".',
          "bearer_token? (string)": "API key for bearer auth.",
        },
        response: "{ id, name, url, ... }",
      },
    ],
  },
  {
    label: "Team",
    value: "team",
    endpoints: [
      {
        method: "GET",
        path: "/api/team/profile",
        description: "Get the current user's profile.",
        auth: "session",
        response: "{ id, email, displayName }",
      },
      {
        method: "PATCH",
        path: "/api/team/profile",
        description: "Update display name or password.",
        auth: "session",
        body: {
          "displayName? (string)": "1–100 characters.",
          "password? (string)": "8–128 characters.",
        },
        response: "Updated profile object",
      },
      {
        method: "GET",
        path: "/api/team/members",
        description: "List all organization members.",
        auth: "session",
        response: '{ id, userId, email, role: "owner" | "admin" | "member" }[]',
      },
      {
        method: "PATCH",
        path: "/api/team/members",
        description: "Update a member's role. Owner only.",
        auth: "session",
        body: {
          "userId (string)": "UUID of target member.",
          'role ("owner" | "admin" | "member")': "New role.",
        },
        response: "Updated member object",
      },
      {
        method: "DELETE",
        path: "/api/team/members",
        description: "Remove a member from the organization. Owner only.",
        auth: "session",
        body: { "userId (string)": "UUID of member to remove." },
        response: "204 No Content",
      },
      {
        method: "GET",
        path: "/api/team/invite",
        description: "List pending invitations.",
        auth: "session",
        response: "{ id, email, role, status, created_at, expires_at }[]",
      },
      {
        method: "POST",
        path: "/api/team/invite",
        description: "Send an invitation email. Owner only.",
        auth: "session",
        body: {
          "email (string)": "Required. Email to invite.",
          'role? ("admin" | "member")': 'Defaults to "member".',
        },
        response: "Invitation object — 201",
      },
      {
        method: "DELETE",
        path: "/api/team/invite/[id]",
        description: "Revoke a pending invitation. Owner only.",
        auth: "session",
        response: "204 No Content",
      },
    ],
  },
  {
    label: "Billing",
    value: "billing",
    endpoints: [
      {
        method: "GET",
        path: "/api/billing/credits",
        description: "Get the organization's current credit balance and Stripe status.",
        auth: "session",
        response: "{ credits: number, hasStripeCustomer: boolean, orgId: string }",
      },
      {
        method: "POST",
        path: "/api/billing/checkout",
        description: "Create a Stripe checkout session to purchase credits. Owner/admin only.",
        auth: "session",
        body: {
          "packageId (string)": "Required. ID of the credit package to purchase.",
        },
        response: "{ url: string }",
      },
      {
        method: "GET",
        path: "/api/billing/usage",
        description:
          "Get usage statistics: tokens, costs, and credits broken down by period, operation, and model.",
        auth: "session",
        response:
          "{ today, thisWeek, thisMonth: { total_tokens, total_cost, total_credits, operations }, byOperation: [...], byModel: [...] }",
      },
    ],
  },
  {
    label: "Settings",
    value: "settings",
    endpoints: [
      {
        method: "GET",
        path: "/api/settings/source-weights",
        description:
          "Get trust weights for each context source type (linear, github, slack, etc.).",
        auth: "session",
        response: "{ weights: Record<string, number> }",
      },
      {
        method: "PATCH",
        path: "/api/settings/source-weights",
        description:
          "Update the trust weight for a specific source type. Applies to all context items from that source.",
        auth: "session",
        body: {
          "provider (string)": "Required. Source type name.",
          "weight (number)": "Required. Weight between 0.1 and 2.0.",
        },
        response: "{ success: true, provider, weight }",
      },
      {
        method: "GET",
        path: "/api/settings/notifications",
        description:
          "Get notification preferences for the current user. Creates defaults if none exist.",
        auth: "session",
        response:
          "{ digest_enabled, digest_time, email_on_mention, email_on_action_item, email_on_new_context, weekly_summary }",
      },
      {
        method: "PATCH",
        path: "/api/settings/notifications",
        description: "Update notification preferences. All fields optional.",
        auth: "session",
        body: {
          "digest_enabled? (boolean)": "Enable/disable daily digest.",
          "digest_time? (string)": "HH:MM format for digest delivery.",
          "email_on_mention? (boolean)": "Email when mentioned.",
          "email_on_action_item? (boolean)": "Email for new action items.",
          "email_on_new_context? (boolean)": "Email for new context items.",
          "weekly_summary? (boolean)": "Enable/disable weekly summary.",
        },
        response: "{ success: true }",
      },
    ],
  },
  {
    label: "Analytics",
    value: "analytics",
    endpoints: [
      {
        method: "GET",
        path: "/api/analytics/content-health",
        description:
          "Get content health analytics: freshness distribution, staleness by source and content type, health score.",
        auth: "session",
        response:
          "{ total, byFreshness: { fresh, aging, stale, veryStale }, bySource: [...], byContentType: [...], staleItems: [...], healthScore: number }",
      },
    ],
  },
  {
    label: "Webhooks",
    value: "webhooks",
    endpoints: [
      {
        method: "POST",
        path: "/api/webhooks/stripe",
        description:
          "Stripe webhook handler. Processes checkout.session.completed, subscription updates/deletions, and failed payments. Idempotent.",
        auth: "webhook-secret",
        body: {
          "(raw body)": "Stripe event payload. Verified via stripe-signature header.",
        },
        response: "{ received: true }",
      },
      {
        method: "POST",
        path: "/api/webhooks/linear",
        description:
          "Linear webhook handler. Processes Issue, Comment, Project, and Cycle events (create/update/remove). Runs AI extraction pipeline.",
        auth: "webhook-secret",
        body: {
          "(raw body)": "Linear event payload. Verified via linear-signature HMAC-SHA256 header.",
        },
        response: "{ received: true }",
      },
      {
        method: "POST",
        path: "/api/webhooks/discord",
        description:
          "Discord webhook handler. Responds to PING verification, processes MESSAGE_CREATE and THREAD_CREATE events. Runs AI extraction pipeline.",
        auth: "webhook-secret",
        body: {
          "(raw body)": "Discord interaction/event payload. Verified via Ed25519 signature.",
        },
        response: "{ received: true } or { type: 1 } for PING",
      },
      {
        method: "POST",
        path: "/api/webhooks/ingest",
        description: "External webhook for ingesting content directly into the system.",
        auth: "webhook-secret",
        body: {
          "title (string)": "Required.",
          "content (string)": "Required.",
          "source_type (string)": "Required.",
          "org_id (string)": "Required.",
          "metadata? (object)": "Optional extra metadata.",
        },
        response: '{ id, status: "accepted" }',
      },
    ],
  },
  {
    label: "System",
    value: "system",
    endpoints: [
      {
        method: "GET",
        path: "/api/health",
        description:
          "Health check endpoint for monitoring context, integrations, and agent metrics.",
        auth: "optional",
        params: { "org_id (string)": "Required query parameter." },
        response:
          "{ status, timestamp, context_health, integrations, agent }",
      },
      {
        method: "GET",
        path: "/api/audit",
        description: "Fetch paginated audit logs for the organization.",
        auth: "session",
        params: {
          "limit? (number)": "Default 50, max 100.",
          "offset? (number)": "Default 0.",
        },
        response:
          "{ id, user_id, action, resource_type, resource_id, metadata, created_at }[]",
      },
      {
        method: "GET",
        path: "/api/cron/digest",
        description:
          "Alias for inbox/generate. Vercel Cron-compatible endpoint that generates daily digest inbox items.",
        auth: "cron-secret",
        response: "{ generated: number, users: number, errors?: string[] }",
      },
    ],
  },
];

const ALL_ENDPOINTS = CATEGORIES.flatMap((c) =>
  c.endpoints.map((e) => ({ ...e, category: c.label }))
);

/* ------------------------------------------------------------------ */
/*  Helper components                                                 */
/* ------------------------------------------------------------------ */

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  POST: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  PATCH: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-400",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold font-mono ${METHOD_COLORS[method] ?? ""}`}
    >
      {method}
    </span>
  );
}

function AuthBadge({ auth }: { auth: Endpoint["auth"] }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    session: { label: "Session", icon: <Lock className="h-3 w-3" />, cls: "text-yellow-700 dark:text-yellow-400 border-yellow-500/30" },
    optional: { label: "Optional", icon: <Globe className="h-3 w-3" />, cls: "text-muted-foreground border-border" },
    "cron-secret": { label: "Cron Secret", icon: <Zap className="h-3 w-3" />, cls: "text-purple-700 dark:text-purple-400 border-purple-500/30" },
    "webhook-secret": { label: "Webhook Secret", icon: <Zap className="h-3 w-3" />, cls: "text-purple-700 dark:text-purple-400 border-purple-500/30" },
    none: { label: "None", icon: <Globe className="h-3 w-3" />, cls: "text-muted-foreground border-border" },
  };
  const info = map[auth] ?? map.none;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${info.cls}`}>
      {info.icon}
      {info.label}
    </span>
  );
}

function SchemaTable({ title, data }: { title: string; data: Record<string, string> }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{title}</p>
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <tbody className="divide-y">
            {Object.entries(data).map(([key, desc]) => (
              <tr key={key} className="hover:bg-muted/30">
                <td className="px-3 py-1.5 font-mono text-foreground whitespace-nowrap align-top">
                  {key}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  return (
    <AccordionItem value={`${endpoint.method}-${endpoint.path}`} className="border-b-0">
      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-md hover:no-underline">
        <div className="flex items-center gap-3 text-left">
          <MethodBadge method={endpoint.method} />
          <code className="text-sm font-mono">{endpoint.path}</code>
          <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[300px]">
            {endpoint.description.split(".")[0]}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">{endpoint.description}</p>

          <div className="flex flex-wrap gap-2">
            <AuthBadge auth={endpoint.auth} />
            {endpoint.rateLimit && (
              <Badge variant="outline" className="text-[10px] font-normal">
                {endpoint.rateLimit}
              </Badge>
            )}
          </div>

          {endpoint.params && <SchemaTable title="Query Parameters" data={endpoint.params} />}
          {endpoint.body && <SchemaTable title="Request Body" data={endpoint.body} />}

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Response</p>
            <pre className="rounded-md bg-muted/50 px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {endpoint.response}
            </pre>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function ApiDocsPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return ALL_ENDPOINTS.filter(
      (e) =>
        e.path.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="flex flex-col p-4 sm:p-8 gap-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileCode2 className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold">API Reference</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Documentation for all Granger API endpoints. All endpoints are under{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">/api</code>.
        </p>
      </div>

      {/* Auth legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3" /> <strong>Session</strong> — Supabase auth cookie
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3" /> <strong>Secret</strong> — Header-based token
        </span>
        <span className="flex items-center gap-1">
          <Globe className="h-3 w-3" /> <strong>None / Optional</strong> — Public or optional auth
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search endpoints by path, method, or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Search results */}
      {filtered ? (
        filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No endpoints match &ldquo;{search}&rdquo;.
          </p>
        ) : (
          <div className="border rounded-lg">
            <Accordion type="multiple">
              {filtered.map((ep) => (
                <EndpointCard key={`${ep.method}-${ep.path}`} endpoint={ep} />
              ))}
            </Accordion>
          </div>
        )
      ) : (
        /* Tabbed view */
        <Tabs defaultValue="chat">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value} className="text-xs">
                {cat.label}
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                  {cat.endpoints.length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map((cat) => (
            <TabsContent key={cat.value} value={cat.value} className="mt-4">
              <div className="border rounded-lg">
                <Accordion type="multiple">
                  {cat.endpoints.map((ep) => (
                    <EndpointCard key={`${ep.method}-${ep.path}`} endpoint={ep} />
                  ))}
                </Accordion>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
