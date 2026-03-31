import { tool } from "ai";
import { z } from "zod";
import { searchContext, searchContextChunks } from "@/lib/db/search";
import { SupabaseClient } from "@supabase/supabase-js";
import { calculateNextCron } from "@/lib/cron";
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

export type ServicePermission = { read: boolean; write: boolean };

export type ToolPermissions = {
  linear?: ServicePermission;
  gmail?: ServicePermission;
  notion?: ServicePermission;
  granola?: ServicePermission;
  drive?: ServicePermission;
};

/** Maps tool names to their service and access type (read or write). */
const TOOL_SERVICE_MAP: Record<string, { service: keyof ToolPermissions; access: "read" | "write" }> = {
  list_linear_issues:  { service: "linear",  access: "read" },
  create_linear_issue: { service: "linear",  access: "write" },
  ask_linear_agent:    { service: "linear",  access: "read" },
  query_granola:       { service: "granola", access: "read" },
  ask_granola_agent:   { service: "granola", access: "read" },
  search_gmail:        { service: "gmail",   access: "read" },
  draft_email:         { service: "gmail",   access: "write" },
  ask_gmail_agent:     { service: "gmail",   access: "read" },
  search_notion:       { service: "notion",  access: "read" },
  ask_notion_agent:    { service: "notion",  access: "read" },
  list_drive_files:    { service: "drive",   access: "read" },
  ask_drive_agent:     { service: "drive",   access: "read" },
};

/** Filter tools based on user permissions. Tools not in TOOL_SERVICE_MAP are always included. */
function applyPermissions<T extends Record<string, unknown>>(
  tools: T,
  permissions?: ToolPermissions,
): T {
  if (!permissions) return tools;

  const filtered = { ...tools };
  for (const [toolName, mapping] of Object.entries(TOOL_SERVICE_MAP)) {
    const perm = permissions[mapping.service];
    if (!perm) continue;

    const allowed = mapping.access === "write" ? perm.write : perm.read;
    if (!allowed && toolName in filtered) {
      delete filtered[toolName];
    }
  }
  return filtered;
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

export function createTools(supabase: AnySupabase, orgId: string, clients?: ToolClients, userId?: string, permissions?: ToolPermissions) {
  const allTools = {
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

    // === Sub-agent delegating tools ===
    ask_linear_agent: tool({
      description:
        "Delegate to the Linear specialist agent for any task/issue management questions. Use this for ALL Linear-related requests instead of calling Linear tools directly.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The full user request about Linear/tasks/issues"),
      }),
      execute: async ({ query }) => {
        if (!clients?.linear)
          return {
            error:
              "Linear not configured. Add your API key in Settings → API Keys.",
          };
        const { runLinearAgent } = await import(
          "@/lib/ai/agents/linear-agent"
        );
        const result = await runLinearAgent(
          query,
          clients.linear,
          orgId,
          supabase,
        );
        return { response: result.text, toolCalls: result.toolCalls.length };
      },
    }),

    ask_gmail_agent: tool({
      description:
        "Delegate to the Gmail specialist agent for email-related requests.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The full user request about emails"),
      }),
      execute: async ({ query }) => {
        if (!clients?.gmail)
          return {
            error:
              "Gmail not configured. Connect Google account in Settings → API Keys.",
          };
        const { runGmailAgent } = await import(
          "@/lib/ai/agents/gmail-agent"
        );
        const result = await runGmailAgent(
          query,
          clients.gmail,
          orgId,
          supabase,
        );
        return { response: result.text, toolCalls: result.toolCalls.length };
      },
    }),

    ask_notion_agent: tool({
      description:
        "Delegate to the Notion specialist agent for page/database queries.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The full user request about Notion pages/databases"),
      }),
      execute: async ({ query }) => {
        if (!clients?.notion)
          return {
            error:
              "Notion not configured. Add your integration token in Settings → API Keys.",
          };
        const { runNotionAgent } = await import(
          "@/lib/ai/agents/notion-agent"
        );
        const result = await runNotionAgent(
          query,
          clients.notion,
          orgId,
          supabase,
        );
        return { response: result.text, toolCalls: result.toolCalls.length };
      },
    }),

    ask_granola_agent: tool({
      description:
        "Delegate to the Granola specialist agent for meeting transcript queries.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The full user request about meetings/transcripts"),
      }),
      execute: async ({ query }) => {
        if (!clients?.granola)
          return {
            error:
              "Granola not configured. Add your API key in Settings → API Keys.",
          };
        const { runGranolaAgent } = await import(
          "@/lib/ai/agents/granola-agent"
        );
        const result = await runGranolaAgent(
          query,
          clients.granola,
          orgId,
          supabase,
        );
        return { response: result.text, toolCalls: result.toolCalls.length };
      },
    }),

    ask_drive_agent: tool({
      description:
        "Delegate to the Drive specialist agent for file search and reading.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The full user request about Drive files"),
      }),
      execute: async ({ query }) => {
        if (!clients?.drive)
          return {
            error:
              "Drive not configured. Connect Google account in Settings → API Keys.",
          };
        const { runDriveAgent } = await import(
          "@/lib/ai/agents/drive-agent"
        );
        const result = await runDriveAgent(
          query,
          clients.drive,
          orgId,
          supabase,
        );
        return { response: result.text, toolCalls: result.toolCalls.length };
      },
    }),

    // === Scheduling tool ===
    schedule_action: tool({
      description:
        'Schedule a recurring or one-time action. Use when the user says "every morning", "weekly", "tomorrow at 9am", "remind me", "check every hour", etc.',
      inputSchema: z.object({
        name: z.string().describe("Short name for the schedule"),
        description: z.string().optional().describe("What this schedule does"),
        action_type: z
          .enum(["query", "sync", "digest", "custom"])
          .describe("Type of action"),
        target_service: z
          .string()
          .optional()
          .describe("Target service: linear, gmail, granola, slack, notion"),
        payload: z
          .record(z.string(), z.unknown())
          .describe("Action details — query text, filters, etc."),
        schedule: z
          .string()
          .describe(
            'Cron expression like "0 7 * * 1-5" for weekday 7am, or "once:ISO_DATE" for one-shot'
          ),
        max_runs: z
          .number()
          .optional()
          .describe("Max executions. 1 for one-shot, omit for unlimited"),
      }),
      execute: async (input) => {
        const nextRun = input.schedule.startsWith("once:")
          ? input.schedule.replace("once:", "")
          : calculateNextCron(input.schedule);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("scheduled_actions")
          .insert({
            org_id: orgId,
            created_by: userId ?? orgId, // fallback to orgId if userId not passed
            name: input.name,
            description: input.description ?? null,
            action_type: input.action_type,
            target_service: input.target_service ?? null,
            payload: input.payload,
            schedule: input.schedule,
            next_run_at: nextRun,
            max_runs: input.max_runs ?? null,
            status: "active",
          })
          .select("id")
          .single();

        if (error) return { error: error.message };
        return {
          message: `Scheduled "${input.name}" — ${input.schedule.startsWith("once:") ? "one-time" : "recurring"}`,
          id: data.id,
        };
      },
    }),

    list_schedules: tool({
      description: "List all scheduled actions. Use when user asks about schedules, /schedule, or wants to see what is running.",
      inputSchema: z.object({
        status: z.enum(["active", "paused", "completed", "all"]).optional().describe("Filter by status, default all"),
      }),
      execute: async (input) => {
        const query = (supabase as any).from("scheduled_actions").select("id, name, description, schedule, status, action_type, target_service, last_run_at, next_run_at, run_count").eq("org_id", orgId).order("created_at", { ascending: false });
        if (input.status && input.status !== "all") query.eq("status", input.status);
        const { data, error } = await query.limit(20);
        if (error) return { error: error.message };
        return { schedules: data ?? [], total: data?.length ?? 0 };
      },
    }),

    edit_schedule: tool({
      description: "Edit an existing scheduled action. Can change name, schedule, status (pause/resume), or description. Use when user says 'change the schedule', 'pause it', 'make it run every hour instead'.",
      inputSchema: z.object({
        id: z.string().describe("Schedule ID to edit"),
        name: z.string().optional(),
        description: z.string().optional(),
        schedule: z.string().optional().describe("New cron expression or once:ISO_DATE"),
        status: z.enum(["active", "paused"]).optional().describe("Pause or resume"),
      }),
      execute: async (input) => {
        const updates: Record<string, unknown> = {};
        if (input.name) updates.name = input.name;
        if (input.description) updates.description = input.description;
        if (input.schedule) {
          updates.schedule = input.schedule;
          updates.next_run_at = input.schedule.startsWith("once:") ? input.schedule.replace("once:", "") : calculateNextCron(input.schedule);
        }
        if (input.status) updates.status = input.status;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await (supabase as any).from("scheduled_actions").update(updates).eq("id", input.id).eq("org_id", orgId).select("id, name, status, schedule").single();
        if (error) return { error: error.message };
        if (!data) return { error: "Schedule not found" };
        return { message: `Updated "${data.name}" — status: ${data.status}, schedule: ${data.schedule}`, schedule: data };
      },
    }),

    delete_schedule: tool({
      description: "Delete a scheduled action permanently. Use when user says 'remove that schedule', 'delete it', 'cancel the recurring task'.",
      inputSchema: z.object({
        id: z.string().describe("Schedule ID to delete"),
      }),
      execute: async (input) => {
        const { data, error } = await (supabase as any).from("scheduled_actions").delete().eq("id", input.id).eq("org_id", orgId).select("id, name").single();
        if (error) return { error: error.message };
        if (!data) return { error: "Schedule not found" };
        return { message: `Deleted schedule "${data.name}"`, deleted: true };
      },
    }),

    // === Code execution tool ===
    run_code: tool({
      description:
        "Write and execute code in a sandboxed Vercel VM. Use for: running scripts, data processing, calculations, API testing, or serving HTML/CSS/React for live preview. For HTML: auto-serves with a static server and returns a live preview URL. For JS/Python: executes and returns stdout.",
      inputSchema: z.object({
        code: z.string().describe("The code to execute or serve"),
        language: z
          .enum(["javascript", "typescript", "python", "html"])
          .describe("Programming language. Use 'html' for web pages that need a live preview URL."),
        filename: z
          .string()
          .optional()
          .describe('Filename, e.g. "analyze.js" or "report.py"'),
        packages: z
          .array(z.string())
          .optional()
          .describe("npm/pip packages to install before running"),
        description: z
          .string()
          .optional()
          .describe("What this code does"),
        expose_port: z
          .number()
          .optional()
          .describe(
            "Port to expose for live preview (e.g. 3000 for a web server)"
          ),
      }),
      execute: async (input) => {
        try {
          const { executeInSandbox } = await import("@/lib/sandbox/execute");
          const result = await executeInSandbox({
            code: input.code,
            language: input.language,
            filename: input.filename,
            installPackages: input.packages,
            exposePort: input.expose_port,
            timeout: 30_000,
          });

          // Save the code to context library
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("context_items").insert({
            org_id: orgId,
            source_type: "code",
            source_id: `sandbox-${Date.now()}`,
            content_type: "file",
            title: input.filename ?? `${input.language} script`,
            raw_content: input.code,
            description_short:
              input.description ?? `Executed ${input.language} code`,
            status: "ready",
          });

          return {
            stdout: result.stdout.slice(0, 4000),
            stderr: result.stderr.slice(0, 1000),
            exitCode: result.exitCode,
            previewUrl: result.previewUrl ?? null,
            success: result.exitCode === 0,
            language: input.language,
            filename: input.filename ?? null,
            code: input.code,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            error: msg,
            stdout: "",
            stderr: msg,
            exitCode: 1,
            success: false,
          };
        }
      },
    }),

    // === Code artifact tool ===
    write_code: tool({
      description: "Write a code artifact (script, config, template, snippet). Use when the user asks you to write code, create a script, generate a config file, or build a template.",
      inputSchema: z.object({
        filename: z.string().describe("Filename with extension, e.g. 'setup.sh', 'config.json'"),
        language: z.string().describe("Programming language: typescript, python, bash, html, css, json, yaml, markdown, sql, go, rust, ruby, jsx, tsx"),
        code: z.string().describe("The full code content"),
        description: z.string().optional().describe("Brief description of what this code does"),
      }),
      execute: async (input) => {
        // Store as a context_item so it's searchable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("context_items")
          .insert({
            org_id: orgId,
            source_type: "code",
            source_id: `code-${Date.now()}`,
            content_type: "file",
            title: input.filename,
            raw_content: input.code,
            description_short: input.description ?? `${input.language} file: ${input.filename}`,
            status: "ready",
          })
          .select("id")
          .single();

        return {
          filename: input.filename,
          language: input.language,
          code: input.code,
          context_id: data?.id,
          message: `Created ${input.filename}. You can find it in the Context Library.`,
        };
      },
    }),

    // === Approval query tool ===
    list_approvals: tool({
      description: 'List pending approval items. Use when the user asks about approvals, /approve, or wants to see what actions are waiting for review.',
      inputSchema: z.object({
        status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().describe('Filter by status, default pending'),
        limit: z.number().optional(),
      }),
      execute: async (input) => {
        const status = input.status ?? 'pending';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query = (supabase as any).from('approval_queue').select('id, action_type, target_service, payload, reasoning, conflict_reason, status, created_at, reviewed_at');
        if (status !== 'all') query.eq('status', status);
        query.eq('org_id', orgId).order('created_at', { ascending: false }).limit(input.limit ?? 10);
        const { data, error } = await query;
        if (error) return { error: error.message };
        return {
          items: (data ?? []).map((item: { id: string; action_type: string; target_service: string; reasoning: string; conflict_reason: string | null; status: string; created_at: string; reviewed_at: string | null; payload: Record<string, unknown> }) => ({
            id: item.id,
            action: item.action_type,
            service: item.target_service,
            reasoning: item.reasoning,
            conflict: item.conflict_reason,
            status: item.status,
            created: item.created_at,
            reviewed: item.reviewed_at,
            payload: item.payload,
            approve_url: `/approvals`,
          })),
          total: data?.length ?? 0,
        };
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

    // === Web search tool ===
    web_search: tool({
      description:
        "Search the web for current information. Use when the user asks about recent events, needs facts you dont know, wants to look something up, or needs real-time data. Returns results with citations.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
      }),
      execute: async ({ query }) => {
        try {
          const { generateText } = await import("ai");
          const { gateway } = await import("@/lib/ai/config");

          const { text } = await generateText({
            model: gateway("perplexity/sonar"),
            prompt: query,
          });

          return {
            query,
            result: text,
            source: "perplexity/sonar",
          };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : "Search failed",
            query,
          };
        }
      },
    }),

    // === Skill activation tool ===
    activate_skill: tool({
      description:
        "Activate a skill to load its specialized instructions and tools. Use when the user types a skill slash command (e.g. /pm, /email, /meeting, /code, /weekly, /brand) or says 'use the [skill name] skill'.",
      inputSchema: z.object({
        skill_slug: z.string().describe("The slug of the skill to activate"),
      }),
      execute: async ({ skill_slug }: { skill_slug: string }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: skill, error } = await (supabase as any)
          .from("skills")
          .select("*")
          .eq("org_id", orgId)
          .eq("slug", skill_slug)
          .eq("is_active", true)
          .single();

        if (error || !skill) {
          return { error: `Skill "${skill_slug}" not found or inactive` };
        }

        return {
          activated: true,
          name: skill.name,
          systemPrompt: skill.system_prompt,
          tools: skill.tools,
          message: `Skill "${skill.name}" activated. ${skill.description}`,
        };
      },
    }),
  };

  return applyPermissions(allTools, permissions);
}
