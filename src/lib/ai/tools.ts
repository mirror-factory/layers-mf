import { tool } from "ai";
import { z } from "zod";
import { searchContext, searchContextChunks } from "@/lib/db/search";
import { SupabaseClient } from "@supabase/supabase-js";
import type { GranolaClient } from "@/lib/api";
import type { LinearApiClient } from "@/lib/api";
import type { NotionClient } from "@/lib/api";
import type { GmailClient } from "@/lib/api";
import type { DriveClient } from "@/lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export interface ToolClients {
  granola?: GranolaClient;
  linear?: LinearApiClient;
  notion?: NotionClient;
  gmail?: GmailClient;
  drive?: DriveClient;
}

const searchContextSchema = z.object({
  query: z.string().describe("The search query"),
  limit: z.number().min(1).max(20).describe("Maximum results").optional(),
  filters: z
    .object({
      sourceType: z.string().optional().describe("Filter by source type (e.g. upload, linear, gdrive)"),
      contentType: z.string().optional().describe("Filter by content type (e.g. document, meeting_transcript, issue)"),
    })
    .optional()
    .describe("Optional filters to narrow search results"),
});

const getDocumentSchema = z.object({
  id: z.string().describe("The document ID from search_context results"),
});

export function createTools(supabase: AnySupabase, orgId: string, clients?: ToolClients) {
  return {
    search_context: tool({
      description:
        "Search the team knowledge base for relevant documents, meetings, messages, and notes. Call this first to find what context exists before answering.",
      inputSchema: searchContextSchema,
      execute: async ({ query, limit, filters }: z.infer<typeof searchContextSchema>) => {
        // Try chunk-based search first (richer context), fall back to item-level
        const chunkResults = await searchContextChunks(
          supabase as Parameters<typeof searchContextChunks>[0],
          orgId,
          query,
          limit ?? 8,
          filters,
          true // enable multi-query expansion
        );

        if (chunkResults.length > 0) {
          return chunkResults.map((r) => ({
            id: r.context_item_id,
            title: r.title,
            source_type: r.source_type,
            content_type: r.content_type,
            rrf_score: r.rrf_score,
            trust_weight: r.trust_weight,
            days_ago: r.days_ago,
            description_short: r.description_short,
            parent_content: r.parent_content,
            source_url: r.source_url,
            source_created_at: r.source_created_at,
          }));
        }

        // Fallback to original item-level search
        const results = await searchContext(
          supabase as Parameters<typeof searchContext>[0],
          orgId,
          query,
          limit ?? 8,
          filters,
          true // enable multi-query expansion
        );
        return results.map((r) => ({
          id: r.id,
          title: r.title,
          source_type: r.source_type,
          content_type: r.content_type,
          rrf_score: r.rrf_score,
          trust_weight: r.trust_weight,
          days_ago: r.days_ago,
          description_short: r.description_short,
          source_url: r.source_url,
          source_created_at: r.source_created_at,
        }));
      },
    }),

    get_document: tool({
      description:
        "Fetch the full text content of a specific document by its ID. Use this when a search result seems highly relevant and you need the complete content to answer accurately.",
      inputSchema: getDocumentSchema,
      execute: async ({ id }: z.infer<typeof getDocumentSchema>) => {
        const { data, error } = await supabase
          .from("context_items")
          .select("id, title, raw_content, source_type, content_type, source_metadata, source_created_at")
          .eq("id", id)
          .eq("org_id", orgId)
          .single();
        if (error || !data) return { error: "Document not found" };
        const item = data as {
          title: string;
          raw_content: string | null;
          source_type: string;
          content_type: string;
          source_metadata: { url?: string } | null;
          source_created_at: string | null;
        };
        return {
          title: item.title,
          content: item.raw_content ?? "(no content available)",
          source_type: item.source_type,
          content_type: item.content_type,
          source_url: item.source_metadata?.url ?? null,
          source_created_at: item.source_created_at,
        };
      },
    }),

    // === Linear tools ===
    list_linear_issues: tool({
      description: "Query Linear issues with filters. Use for finding tasks, checking status, seeing what is assigned to whom. Call this when users ask about tasks, issues, or Linear.",
      inputSchema: z.object({
        state: z.string().optional().describe("Filter by state like 'In Progress', 'Todo', 'Done'"),
        assignee: z.string().optional().describe("Filter by assignee name or 'me'"),
        team: z.string().optional().describe("Filter by team key like 'PROD' or 'SERV'"),
        priority: z.number().optional().describe("1=Urgent, 2=High, 3=Medium, 4=Low"),
        limit: z.number().optional().describe("Max results, default 20"),
      }),
      execute: async (input) => {
        if (!clients?.linear) return { error: "Linear not configured. Add your API key in Settings → API Keys." };
        const issues = await clients.linear.listIssues(input);
        return { issues: issues.map(i => ({ id: i.identifier, title: i.title, status: i.state?.name, assignee: i.assignee?.name, priority: i.priority, url: i.url })) };
      },
    }),

    create_linear_issue: tool({
      description: "Create a new Linear issue. Routes through approval queue for partner review before execution.",
      inputSchema: z.object({
        title: z.string(),
        team: z.string().describe("Team key like 'PROD' or 'SERV'"),
        description: z.string().optional(),
        priority: z.number().optional(),
        assignee: z.string().optional(),
      }),
      execute: async (input) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).from("approval_queue").insert({
          org_id: orgId, requested_by_agent: "granger", action_type: "create_task",
          target_service: "linear", payload: input, status: "pending",
          reasoning: `Create Linear issue "${input.title}" in team ${input.team}`,
        }).select("id").single();
        if (error) return { error: `Failed: ${error.message}` };
        return { message: `Proposed creating "${input.title}". Waiting for approval.`, approval_id: data.id };
      },
    }),

    // === Granola tool ===
    query_granola: tool({
      description: "Search meeting notes and transcripts from Granola. Returns recent meetings with summaries and attendees.",
      inputSchema: z.object({
        since: z.string().optional().describe("ISO date to search from, e.g. '2026-03-01'"),
        limit: z.number().optional().describe("Max meetings to return, default 10"),
      }),
      execute: async (input) => {
        if (!clients?.granola) return { error: "Granola not configured. Add your API key in Settings → API Keys." };
        const records = await clients.granola.list({ since: input.since, limit: input.limit ?? 10 });
        return { meetings: records.map(r => ({ id: r.source_id, title: r.title, date: r.source_created_at })) };
      },
    }),

    // === Gmail tools ===
    search_gmail: tool({
      description: "Search emails using Gmail query syntax. Examples: 'from:john', 'subject:invoice', 'newer_than:7d', 'is:unread'.",
      inputSchema: z.object({
        query: z.string().describe("Gmail search query"),
        limit: z.number().optional().describe("Max results, default 10"),
      }),
      execute: async (input) => {
        if (!clients?.gmail) return { error: "Gmail not configured. Connect Google account in Settings → API Keys." };
        const emails = await clients.gmail.searchEmails(input.query, input.limit ?? 10);
        return { emails: emails.map(e => ({ id: e.id, subject: e.subject, from: e.from, date: e.date, snippet: e.snippet })) };
      },
    }),

    draft_email: tool({
      description: "Draft a Gmail email. Routes through approval queue before saving.",
      inputSchema: z.object({
        to: z.string(), subject: z.string(), body: z.string(),
      }),
      execute: async (input) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).from("approval_queue").insert({
          org_id: orgId, requested_by_agent: "granger", action_type: "draft_email",
          target_service: "gmail", payload: input, status: "pending",
          reasoning: `Draft email to ${input.to}: "${input.subject}"`,
        }).select("id").single();
        if (error) return { error: `Failed: ${error.message}` };
        return { message: `Proposed drafting email to ${input.to}. Waiting for approval.`, approval_id: data.id };
      },
    }),

    // === Notion tool ===
    search_notion: tool({
      description: "Search Notion pages and databases shared with the integration.",
      inputSchema: z.object({
        query: z.string().optional().describe("Search query text"),
        limit: z.number().optional().describe("Max results, default 10"),
      }),
      execute: async (input) => {
        if (!clients?.notion) return { error: "Notion not configured. Add your integration token in Settings → API Keys." };
        const results = await clients.notion.search(input.query, input.limit ?? 10);
        return { pages: results.map(r => ({ id: r.id, title: r.title, type: r.object })) };
      },
    }),

    // === Drive tool ===
    list_drive_files: tool({
      description: "List and search Google Drive files (Docs, Sheets, Slides).",
      inputSchema: z.object({
        query: z.string().optional().describe("Search query for file names"),
        limit: z.number().optional().describe("Max results, default 20"),
      }),
      execute: async (input) => {
        if (!clients?.drive) return { error: "Drive not configured. Connect Google account in Settings → API Keys." };
        const files = await clients.drive.listFiles(input.query, input.limit ?? 20);
        return { files: files.map(f => ({ id: f.id, name: f.name, type: f.mimeType, modified: f.modifiedTime })) };
      },
    }),

    // === Approval tool ===
    propose_action: tool({
      description: "Propose a write action for partner approval before executing. Use for ALL write operations.",
      inputSchema: z.object({
        action_type: z.enum(["create_task", "send_message", "draft_email", "update_task", "send_slack", "update_issue"]),
        target_service: z.enum(["linear", "slack", "gmail", "discord", "notion"]),
        payload: z.record(z.string(), z.unknown()).describe("The full action payload"),
        reasoning: z.string().describe("Why this action should be taken"),
        conflict_check: z.string().optional().describe("Any priority document conflicts"),
      }),
      execute: async (input) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).from("approval_queue").insert({
          org_id: orgId, requested_by_agent: "granger",
          action_type: input.action_type, target_service: input.target_service,
          payload: input.payload, reasoning: input.reasoning,
          conflict_reason: input.conflict_check ?? null, status: "pending",
        }).select("id").single();
        if (error) return { error: `Failed: ${error.message}` };
        return { message: "Action proposed. Waiting for approval.", approval_id: data.id };
      },
    }),
  };
}
