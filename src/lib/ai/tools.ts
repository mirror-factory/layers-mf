import { tool } from "ai";
import { z } from "zod";
import { searchContext, searchContextChunks } from "@/lib/db/search";
import { createArtifact, createVersion } from "@/lib/artifacts";
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

/** Generate boilerplate files for project templates so the model only sends custom code */
function getTemplateFiles(template: string): { path: string; content: string }[] {
  if (template === "react") {
    // Use Vite for React — CRA doesn't work in sandboxes (binds to localhost only)
    return [
      { path: "package.json", content: JSON.stringify({
        name: "app", private: true, type: "module",
        scripts: { dev: "vite --host 0.0.0.0", build: "vite build" },
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
        devDependencies: { "@vitejs/plugin-react": "^4.0.0", vite: "^5.0.0" },
      }, null, 2) },
      { path: "index.html", content: '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>App</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>' },
      { path: "vite.config.js", content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()], server: { host: '0.0.0.0', port: 5173, allowedHosts: true } });" },
      { path: "src/main.jsx", content: "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport './index.css';\nimport App from './App.jsx';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);" },
      { path: "src/index.css", content: "* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: -apple-system, system-ui, sans-serif; }" },
      { path: "src/App.jsx", content: "import React from 'react';\n\nexport default function App() {\n  return <div style={{padding: '2rem', textAlign: 'center'}}>\n    <h1>App is running</h1>\n    <p>Edit src/App.jsx to get started</p>\n  </div>;\n}" },
    ];
  }
  if (template === "vite") {
    return [
      { path: "package.json", content: JSON.stringify({
        name: "app", private: true, type: "module",
        scripts: { dev: "vite --host 0.0.0.0", build: "vite build" },
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
        devDependencies: { "@vitejs/plugin-react": "^4.0.0", vite: "^5.0.0" },
      }, null, 2) },
      { path: "index.html", content: '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>App</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>' },
      { path: "vite.config.js", content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()], server: { host: '0.0.0.0', port: 5173, allowedHosts: true } });" },
      { path: "src/main.jsx", content: "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport './index.css';\nimport App from './App.jsx';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);" },
      { path: "src/index.css", content: "* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: -apple-system, system-ui, sans-serif; }" },
      { path: "src/App.jsx", content: "import React from 'react';\n\nexport default function App() {\n  return <div style={{padding: '2rem', textAlign: 'center'}}>\n    <h1>App is running</h1>\n    <p>Edit src/App.jsx to get started</p>\n  </div>;\n}" },
    ];
  }
  if (template === "python") {
    return [
      { path: "requirements.txt", content: "" },
      { path: "main.py", content: "# Main entry point\n" },
    ];
  }
  return [];
}

export function createTools(supabase: AnySupabase, orgId: string, clients?: ToolClients, userId?: string, permissions?: ToolPermissions) {
  const allTools = {
    search_context: tool({
      description: "Search knowledge base for documents, meetings, notes. Call first before answering.",
      inputSchema: searchContextSchema,
      execute: async ({ query, limit, filters }: z.infer<typeof searchContextSchema>) => {
        // Helper: look up source_ids for result IDs and flag artifacts
        const flagArtifacts = async <T extends { id: string }>(results: T[]): Promise<(T & { isArtifact?: boolean; artifactId?: string })[]> => {
          if (results.length === 0) return results;
          const ids = results.map((r) => r.id);
          const { data: items } = await (supabase as any)
            .from("context_items")
            .select("id, source_id")
            .in("id", ids);
          const sourceIdMap = new Map<string, string>();
          if (items) {
            for (const item of items as { id: string; source_id: string | null }[]) {
              if (item.source_id) sourceIdMap.set(item.id, item.source_id);
            }
          }
          return results.map((r) => {
            const sourceId = sourceIdMap.get(r.id);
            if (sourceId && sourceId.startsWith("artifact-")) {
              return { ...r, isArtifact: true, artifactId: sourceId.replace("artifact-", "") };
            }
            return r;
          });
        };

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
          const mapped = chunkResults.map((r) => ({
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
          return flagArtifacts(mapped);
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
        const mapped = results.map((r) => ({
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
        return flagArtifacts(mapped);
      },
    }),

    get_document: tool({
      description: "Fetch full document content by ID. Use when search result needs deeper reading.",
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
      description: "Query Linear issues with filters. For tasks, status checks, assignments.",
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
      description: "Create Linear issue. Routes through approval queue.",
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
      description: "Search Granola meeting notes and transcripts.",
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
      description: "Search Gmail. Syntax: from:, subject:, newer_than:, is:unread.",
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
      description: "Draft Gmail email. Routes through approval queue.",
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
      description: "Search Notion pages and databases.",
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
      description: "List and search Google Drive files.",
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
        "Delegate to Linear specialist. Use for ALL task/issue requests.",
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
      description: "List scheduled actions. For /schedule command.",
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
      description: "Edit schedule: change name, timing, status (pause/resume).",
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
      description: "Delete a scheduled action permanently.",
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

    // === Multi-file project tool ===
    run_project: tool({
      description:
        "Create and run a multi-file project in a sandboxed VM. Use for full apps, npm projects, React apps, APIs, data pipelines. " +
        "Supports templates for quick scaffolding — set `template` to 'react', 'nextjs', or 'vite' and only provide your custom files (App.js, etc). " +
        "For large projects, call this tool multiple times: first to scaffold, then to add/edit individual files with `add_files`. " +
        "Sandbox state persists via snapshots — subsequent runs restore instantly without re-installing.",
      inputSchema: z.object({
        template: z.enum(["none", "react", "nextjs", "vite", "python"]).optional().describe(
          "Project template to scaffold. 'react' = create-react-app, 'vite' = Vite+React, 'nextjs' = Next.js, 'python' = Python with venv. " +
          "When using a template, only provide your custom files (e.g. src/App.js) — boilerplate is auto-generated."
        ),
        files: z.array(z.object({
          path: z.string().describe("File path, e.g. 'src/App.js', 'src/components/Dashboard.jsx'"),
          content: z.string().describe("File content"),
        })).describe("Project files to write. With a template, only include custom/modified files."),
        add_files: z.array(z.object({
          path: z.string().describe("File path to add or overwrite"),
          content: z.string().describe("File content"),
        })).optional().describe("Additional files to add to an existing sandbox (for incremental edits). Use this on follow-up calls to add/update files without re-scaffolding."),
        install_command: z.string().optional().describe("Install command, e.g. 'npm install recharts' for additional packages"),
        run_command: z.string().describe("Command to run, e.g. 'npm run dev' for React/Vite, 'python main.py' for Python. Do NOT use 'npm start' — use 'npm run dev' for web apps."),
        read_output_files: z.array(z.string()).optional().describe("Paths of output files to read back after execution"),
        expose_port: z.number().optional().default(5173).describe("Port to expose for live preview. Defaults to 5173 (Vite). Use 3000 for Next.js, 8000 for Python."),
        description: z.string().optional(),
      }),
      execute: async (input) => {
        const _t0 = Date.now();
        const _log = (msg: string) => console.log(`[run_project +${((Date.now()-_t0)/1000).toFixed(1)}s] ${msg}`);
        try {
          _log("Starting...");
          const { executeProject, getLatestSnapshot } = await import("@/lib/sandbox/execute");

          // Check for existing snapshot to restore from (skips fresh npm install)
          const existingSnapshot = await getLatestSnapshot(orgId);
          const snapshotId = existingSnapshot?.snapshotId;
          _log(`Snapshot: ${snapshotId ? `FOUND ${snapshotId}` : "NONE"}`);
          _log(`Template: ${input.template ?? "auto"}, files: ${input.files.map(f => f.path).join(", ")}`);

          // Auto-fix .js → .jsx for files containing JSX (Vite requires .jsx extension)
          const fixedFiles = input.files.map(f => {
            if (f.path.endsWith(".js") && !f.path.endsWith(".config.js") &&
                (f.content.includes("<div") || f.content.includes("<button") || f.content.includes("<h1") ||
                 f.content.includes("<span") || f.content.includes("<input") || f.content.includes("<App") ||
                 f.content.match(/<[A-Z]/))) {
              _log(`Renamed ${f.path} → ${f.path.replace(/\.js$/, ".jsx")} (contains JSX)`);
              return { ...f, path: f.path.replace(/\.js$/, ".jsx") };
            }
            return f;
          });

          // Template scaffolding — generate boilerplate files so the model only sends custom code
          let allFiles = [...fixedFiles];
          const userPaths = new Set(fixedFiles.map(f => f.path));

          // Auto-detect template if not specified
          let template = input.template ?? "none";
          if (template === "none") {
            const hasReactFiles = input.files.some(f =>
              f.path.match(/App\.(jsx?|tsx?)$/) || f.content.includes("from 'react'") || f.content.includes('from "react"')
            );
            const hasPackageJson = userPaths.has("package.json");
            if (hasReactFiles && !hasPackageJson) {
              template = "react";
            }
          }

          if (template !== "none") {
            const templateFiles = getTemplateFiles(template);

            // Detect the actual App entry file from user files
            const appFile = input.files.find(f =>
              f.path.match(/App\.(jsx?|tsx?)$/) && !f.path.includes("components/")
            );
            const appImportPath = appFile
              ? "./" + appFile.path.replace(/^src\//, "")
              : "./App.jsx";

            // Detect if user has CSS files to import
            const appCss = input.files.find(f =>
              f.path.match(/App\.css$/) || f.path === "src/App.css"
            );
            const indexCss = input.files.find(f =>
              f.path.match(/index\.css$/) || f.path === "src/index.css"
            );

            // Build a custom main.jsx that imports the right files
            const mainImports = [
              "import React from 'react';",
              "import ReactDOM from 'react-dom/client';",
              indexCss ? `import './${indexCss.path.replace(/^src\//, "")}';` : "",
              appCss ? `import './${appCss.path.replace(/^src\//, "")}';` : "",
              `import App from '${appImportPath.replace(/\.(jsx?|tsx?)$/, "")}';`,
            ].filter(Boolean).join("\n");
            const mainContent = `${mainImports}\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`;

            // Replace template main.jsx with custom one
            let patchedTemplateFiles = templateFiles.map(f =>
              f.path === "src/main.jsx" ? { ...f, content: mainContent } : f
            );

            // Auto-detect npm dependencies from user code imports
            const importRegex = /(?:import\s+.*?from\s+['"])([^./][^'"]*?)(?:['"])|(?:require\s*\(\s*['"])([^./][^'"]*?)(?:['"])/g;
            const builtins = new Set(["react", "react-dom", "react-dom/client", "react/jsx-runtime"]);
            const detectedDeps = new Set<string>();
            for (const f of input.files) {
              let match;
              while ((match = importRegex.exec(f.content)) !== null) {
                const pkg = (match[1] ?? match[2]).split("/")[0]; // get base package name
                if (!builtins.has(pkg) && !pkg.startsWith("@vitejs")) {
                  detectedDeps.add(pkg);
                }
              }
            }
            // Also detect from config files
            const hasTailwind = input.files.some(f => f.path.includes("tailwind.config"));
            const hasPostcss = input.files.some(f => f.path.includes("postcss.config"));
            if (hasTailwind) { detectedDeps.add("tailwindcss"); detectedDeps.add("@tailwindcss/vite"); }
            if (hasPostcss) { detectedDeps.add("postcss"); detectedDeps.add("autoprefixer"); }

            // Patch package.json to include detected dependencies
            if (detectedDeps.size > 0) {
              const depsObj: Record<string, string> = {};
              for (const dep of detectedDeps) depsObj[dep] = "latest";

              patchedTemplateFiles = patchedTemplateFiles.map(f => {
                if (f.path === "package.json") {
                  try {
                    const pkg = JSON.parse(f.content);
                    pkg.dependencies = { ...pkg.dependencies, ...depsObj };
                    return { ...f, content: JSON.stringify(pkg, null, 2) };
                  } catch { return f; }
                }
                return f;
              });
              console.log(`[sandbox] Auto-detected deps: ${[...detectedDeps].join(", ")}`);
            }

            // Also patch vite.config if tailwind detected — add tailwind plugin
            if (hasTailwind) {
              patchedTemplateFiles = patchedTemplateFiles.map(f => {
                if (f.path === "vite.config.js" && !f.content.includes("tailwindcss")) {
                  return {
                    ...f,
                    content: `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nimport tailwindcss from '@tailwindcss/vite';\nexport default defineConfig({ plugins: [react(), tailwindcss()], server: { host: '0.0.0.0', port: 5173, allowedHosts: true } });`,
                  };
                }
                return f;
              });
            }

            const scaffoldFiles = patchedTemplateFiles.filter(f => !userPaths.has(f.path));
            allFiles = [...scaffoldFiles, ...input.files];
          }

          // Merge add_files for incremental edits
          if (input.add_files?.length) {
            const addPaths = new Set(input.add_files.map(f => f.path));
            allFiles = [...allFiles.filter(f => !addPaths.has(f.path)), ...input.add_files];
          }

          // Ensure npm install runs when template provides package.json
          const hasPackageJson = allFiles.some(f => f.path === "package.json");
          const installCommand = input.install_command ?? (hasPackageJson && !snapshotId ? "npm install" : undefined);

          // Auto-detect port if not specified — prevents blocking hang on long-running dev servers
          const exposePort = input.expose_port
            ?? (input.run_command.includes("dev") ? 5173 : undefined)
            ?? (input.run_command.includes("start") ? 3000 : undefined);

          // Run sandbox (fast with snapshots: ~5s restore, ~20s cold)
          _log(`executeProject: ${allFiles.length} files, install=${installCommand ?? "none"}, snapshot=${snapshotId ?? "none"}, port=${exposePort ?? "none"}`);
          const result = await executeProject({
            files: allFiles,
            installCommand,
            runCommand: input.run_command,
            readOutputFiles: input.read_output_files,
            exposePort,
            orgId,
            userId,
            snapshotId,
          });
          _log(`executeProject done: exit=${result.exitCode}, preview=${result.previewUrl ?? "none"}`);
          _log("Saving artifact...");
          const artifactResult = await createArtifact(supabase as never, {
            orgId,
            userId,
            type: "sandbox",
            title: input.description ?? `Project: ${allFiles.length} files`,
            description: `${allFiles.length} files: ${allFiles.map(f => f.path).join(", ")}`,
            files: allFiles,
            primaryFilePath: allFiles.find(f => f.path.match(/App\.(jsx?|tsx?)$/))?.path ?? allFiles[0]?.path,
            language: "javascript",
            framework: input.template !== "none" ? input.template : "vite",
            snapshotId: result.snapshotId ?? undefined,
            previewUrl: result.previewUrl ?? undefined,
            runCommand: input.run_command,
            exposePort: input.expose_port,
          });
          const savedArtifactId = "artifactId" in artifactResult ? artifactResult.artifactId : null;
          _log(`Artifact saved: ${savedArtifactId}`);

          return {
            stdout: result.stdout.slice(0, 4000),
            stderr: result.stderr.slice(0, 1000),
            exitCode: result.exitCode,
            previewUrl: result.previewUrl ?? null,
            sandboxId: result.sandboxId,
            snapshotId: result.snapshotId ?? null,
            artifactId: savedArtifactId,
            restoredFromSnapshot: !!snapshotId,
            outputFiles: result.outputFiles,
            fileCount: allFiles.length,
            files: allFiles,
            runCommand: input.run_command,
            exposePort: input.expose_port,
            success: result.exitCode === 0,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Project execution failed", exitCode: 1, success: false };
        }
      },
    }),

    // === Code execution tool ===
    run_code: tool({
      description:
        "Execute a script in a sandboxed VM. ONLY for: running computations, data processing, API testing, Python scripts. Do NOT use for charts, diagrams, visuals, or HTML — use inline ```html blocks instead. Returns stdout/stderr.",
      inputSchema: z.object({
        code: z.string().describe("The code to execute or serve"),
        language: z
          .enum(["javascript", "typescript", "python"])
          .describe("Programming language for script execution."),
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
            orgId,
            userId,
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

    // === GitHub repo ingestion tool ===
    ingest_github_repo: tool({
      description: "Import a GitHub repo into the context library. Clones, reads key files, saves as searchable context.",
      inputSchema: z.object({
        repo: z.string().describe("GitHub repo in owner/repo format"),
        branch: z.string().optional().describe("Branch to clone, defaults to main"),
      }),
      execute: async ({ repo, branch }) => {
        try {
          const { Sandbox } = await import("@vercel/sandbox");
          const sandbox = await Sandbox.create({ runtime: "node24", timeout: 120_000 });

          // Clone the repo
          const branchArg = branch ? `--branch ${branch}` : "";
          const cloneResult = await sandbox.runCommand("git", [
            "clone", "--depth", "1", branchArg, `https://github.com/${repo}.git`, "repo",
          ].filter(Boolean));

          if (cloneResult.exitCode !== 0) {
            const stderr = await cloneResult.stderr();
            await sandbox.stop();
            return { error: `Clone failed: ${stderr}` };
          }

          // Find key files (skip binaries, node_modules, .git, large files)
          const findResult = await sandbox.runCommand("find", [
            "repo", "-type", "f",
            "-not", "-path", "*/node_modules/*",
            "-not", "-path", "*/.git/*",
            "-not", "-path", "*/dist/*",
            "-not", "-path", "*/.next/*",
            "-not", "-name", "*.png", "-not", "-name", "*.jpg",
            "-not", "-name", "*.ico", "-not", "-name", "*.woff*",
            "-not", "-name", "*.lock", "-not", "-name", "package-lock.json",
            "-size", "-50k",
          ]);
          const allFiles = (await findResult.stdout()).split("\n").filter(Boolean);

          // Prioritize important files
          const priority = ["README", "package.json", "tsconfig", ".env.example", "Dockerfile"];
          const srcFiles = allFiles.filter(f =>
            f.includes("/src/") || f.includes("/lib/") || f.includes("/app/") ||
            f.includes("/pages/") || f.includes("/components/") ||
            priority.some(p => f.includes(p))
          ).slice(0, 50); // Max 50 files

          // Read file contents
          const items: { path: string; content: string }[] = [];
          for (const filePath of srcFiles) {
            try {
              const stream = await sandbox.readFile({ path: filePath });
              if (stream) {
                const chunks: Buffer[] = [];
                for await (const chunk of stream) {
                  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                const content = Buffer.concat(chunks).toString("utf-8");
                if (content.length > 0 && content.length < 50000) {
                  items.push({ path: filePath.replace("repo/", ""), content });
                }
              }
            } catch { /* skip unreadable files */ }
          }

          await sandbox.stop();

          // Save each file as a context_item
          let savedCount = 0;
          for (const item of items) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabase as any)
              .from("context_items")
              .insert({
                org_id: orgId,
                source_type: "github",
                source_id: `${repo}:${item.path}`,
                title: `${repo}: ${item.path}`,
                raw_content: item.content,
                content_type: "code",
                status: "ready",
                ingested_at: new Date().toISOString(),
              });
            if (!error) savedCount++;
          }

          return {
            repo,
            totalFiles: allFiles.length,
            importedFiles: savedCount,
            skippedFiles: items.length - savedCount,
            files: items.map(i => i.path).slice(0, 20),
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Ingestion failed" };
        }
      },
    }),

    // === Compliance review tool ===
    review_compliance: tool({
      description: "Review content against org rules and priority documents. Checks each rule/guideline individually and returns pass/fail with explanations. Use when asked to review, audit, check compliance, or validate content against brand guidelines, rules, or standards.",
      inputSchema: z.object({
        content: z.string().describe("The content to review (document text, web page content, draft, etc.)"),
        content_label: z.string().optional().describe("What this content is, e.g. 'Blog post draft', 'Landing page copy'"),
      }),
      execute: async ({ content, content_label }) => {
        // 1. Fetch all active rules
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rules } = await (supabase as any)
          .from("rules")
          .select("id, text, is_active, priority")
          .eq("org_id", orgId)
          .eq("is_active", true)
          .order("priority", { ascending: true });

        // 2. Fetch all active priority documents
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: docs } = await (supabase as any)
          .from("priority_documents")
          .select("id, filename, content, is_active, weight")
          .eq("org_id", orgId)
          .eq("is_active", true)
          .order("weight", { ascending: true });

        const activeRules = (rules ?? []) as { id: string; text: string; priority: number }[];
        const activeDocs = (docs ?? []) as { id: string; filename: string; content: string }[];

        if (activeRules.length === 0 && activeDocs.length === 0) {
          return {
            type: "compliance-review" as const,
            content_label: content_label ?? "Content",
            error: "No active rules or priority documents found. Add rules in Priority & Rules page.",
            checks: [],
            summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
          };
        }

        // 3. Build checklist items from rules + extract guidelines from priority docs
        const checkItems: { id: string; source: string; rule: string }[] = [];

        for (const rule of activeRules) {
          checkItems.push({
            id: rule.id,
            source: "Rule",
            rule: rule.text,
          });
        }

        // Extract key guidelines from priority docs (use first 200 chars as summary)
        for (const doc of activeDocs) {
          // Split doc content into distinct guidelines/bullet points
          const lines = doc.content
            .split(/\n/)
            .map((l: string) => l.trim())
            .filter((l: string) => l.length > 10 && (l.startsWith("-") || l.startsWith("•") || l.startsWith("*") || l.match(/^\d+\./)));

          if (lines.length > 0) {
            // Use individual bullet points as guidelines
            for (const line of lines.slice(0, 10)) {
              checkItems.push({
                id: `${doc.id}-${checkItems.length}`,
                source: doc.filename,
                rule: line.replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, ""),
              });
            }
          } else {
            // Use doc as a single guideline
            checkItems.push({
              id: doc.id,
              source: doc.filename,
              rule: doc.content.slice(0, 200),
            });
          }
        }

        // 4. Use Haiku to evaluate each check against the content
        const { generateObject } = await import("ai");
        const { gateway } = await import("@ai-sdk/gateway");

        const checksPrompt = checkItems.map((c, i) =>
          `${i + 1}. [${c.source}] ${c.rule}`
        ).join("\n");

        const { object: results } = await generateObject({
          model: gateway("google/gemini-3.1-flash-lite-preview"),
          schema: z.object({
            checks: z.array(z.object({
              index: z.number(),
              status: z.enum(["pass", "fail", "warning"]),
              explanation: z.string().describe("Brief explanation of why it passes or fails"),
            })),
          }),
          prompt: `You are a compliance reviewer. Review the following content against each rule/guideline and determine if the content complies.

CONTENT TO REVIEW (${content_label ?? "Content"}):
---
${content.slice(0, 6000)}
---

RULES AND GUIDELINES TO CHECK:
${checksPrompt}

For each rule, determine:
- "pass" if the content follows or doesn't violate the rule
- "fail" if the content clearly violates or contradicts the rule
- "warning" if it partially complies or could be improved

Be strict but fair. Return a check for every single rule listed above.`,
          maxOutputTokens: 2000,
        });

        // 5. Merge results with check items
        const checks = checkItems.map((item, i) => {
          const result = results.checks.find((r) => r.index === i + 1) ?? {
            status: "warning" as const,
            explanation: "Could not evaluate",
          };
          return {
            id: item.id,
            source: item.source,
            rule: item.rule,
            status: result.status,
            explanation: result.explanation,
          };
        });

        const passed = checks.filter((c) => c.status === "pass").length;
        const failed = checks.filter((c) => c.status === "fail").length;
        const warnings = checks.filter((c) => c.status === "warning").length;

        return {
          type: "compliance-review" as const,
          content_label: content_label ?? "Content",
          checks,
          summary: {
            total: checks.length,
            passed,
            failed,
            warnings,
            score: Math.round((passed / checks.length) * 100),
          },
        };
      },
    }),

    // === Artifact tools ===
    artifact_list: tool({
      description: "List artifacts. Filter by type, search by title.",
      inputSchema: z.object({
        type: z.enum(["code", "document", "sandbox"]).optional().describe("Filter by artifact type"),
        search: z.string().optional().describe("Search artifacts by title"),
        limit: z.number().optional().default(10).describe("Max results to return"),
      }),
      execute: async ({ type, search, limit }) => {
        const sb = supabase as any;
        let query = sb
          .from("artifacts")
          .select("id, type, title, description_oneliner, tags, current_version, total_cost_usd, updated_at")
          .eq("org_id", orgId)
          .order("updated_at", { ascending: false })
          .limit(limit ?? 10);

        if (type) query = query.eq("type", type);
        if (search) query = query.ilike("title", `%${search}%`);

        const { data, error } = await query;
        if (error) return { error: error.message };
        return { artifacts: data ?? [], count: (data ?? []).length };
      },
    }),

    artifact_get: tool({
      description: "Get artifact content and open it in the artifact viewer. Returns data in the same format as run_project/write_code so the UI auto-opens the artifact panel.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
      }),
      execute: async ({ artifactId }) => {
        const sb = supabase as any;

        // Fetch the artifact
        const { data: artifact, error: artErr } = await sb
          .from("artifacts")
          .select("*")
          .eq("id", artifactId)
          .eq("org_id", orgId)
          .single();

        if (artErr || !artifact) return { error: artErr?.message ?? "Artifact not found" };

        // Fetch files for current version
        const { data: files } = await sb
          .from("artifact_files")
          .select("file_path, content, language, size_bytes")
          .eq("artifact_id", artifactId)
          .eq("version_number", artifact.current_version);

        // Get version count
        const { count: versionCount } = await sb
          .from("artifact_versions")
          .select("id", { count: "exact", head: true })
          .eq("artifact_id", artifactId);

        const artifactFiles = (files ?? []) as { file_path: string; content: string; language: string | null; size_bytes: number | null }[];

        // Determine primary file content and language
        const primaryFile = artifactFiles[0];
        const primaryContent = primaryFile?.content ?? artifact.content ?? "";
        const primaryLanguage = primaryFile?.language ?? artifact.language ?? "text";

        // Build openable response matching run_project/write_code output shape
        const isDocument = artifact.type === "document";
        const isSandbox = artifact.type === "sandbox";

        return {
          // Core fields for artifact panel opening
          filename: artifact.title ?? "Untitled",
          language: isDocument ? "html" : primaryLanguage,
          code: primaryContent,
          type: isDocument ? "document" : "code",
          artifactId: artifact.id,

          // Multi-file support
          files: artifactFiles.length > 0
            ? artifactFiles.map((f) => ({ path: f.file_path, content: f.content }))
            : undefined,

          // Sandbox-specific fields
          previewUrl: isSandbox ? (artifact.preview_url ?? undefined) : undefined,
          snapshotId: isSandbox ? (artifact.snapshot_id ?? undefined) : undefined,
          runCommand: isSandbox ? (artifact.run_command ?? undefined) : undefined,
          exposePort: isSandbox ? (artifact.expose_port ?? undefined) : undefined,

          // Metadata
          currentVersion: artifact.current_version,
          versionCount: versionCount ?? 0,
          description: artifact.description_oneliner ?? undefined,
        };
      },
    }),

    artifact_version: tool({
      description: "List or restore artifact versions.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        action: z.enum(["list", "restore"]).describe("Action to perform"),
        versionNumber: z.number().optional().describe("Version number to restore (required for restore)"),
      }),
      execute: async ({ artifactId, action, versionNumber }) => {
        const sb = supabase as any;

        if (action === "list") {
          const { data: versions, error } = await sb
            .from("artifact_versions")
            .select("version_number, change_summary, change_type, created_at, created_by_ai, model_used, cost_usd")
            .eq("artifact_id", artifactId)
            .order("version_number", { ascending: false });

          if (error) return { error: error.message };
          return { versions: versions ?? [] };
        }

        // Restore action
        if (!versionNumber) return { error: "versionNumber is required for restore" };

        // Get the target version's content
        const { data: targetVersion, error: tvErr } = await sb
          .from("artifact_versions")
          .select("content")
          .eq("artifact_id", artifactId)
          .eq("version_number", versionNumber)
          .single();

        if (tvErr || !targetVersion) return { error: tvErr?.message ?? "Version not found" };

        const result = await createVersion(sb, {
          artifactId,
          content: targetVersion.content,
          changeSummary: `Restored from version ${versionNumber}`,
          changeType: "restore",
          createdBy: userId,
          createdByAi: true,
        });

        return result;
      },
    }),

    // === Artifact panel control (client-side — no execute) ===
    artifact_panel: tool({
      description: "Open or close the artifact side panel. Use when the user asks to open, close, show, or hide an artifact or the artifact panel.",
      inputSchema: z.object({
        action: z.enum(["open", "close"]).describe("Whether to open or close the panel"),
        artifactId: z.string().optional().describe("Artifact ID to open (required for 'open' action)"),
      }),
    }),

    // === Artifact delete tool ===
    artifact_delete: tool({
      description: "Delete an artifact. Use when the user asks to remove or delete an artifact.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID to delete"),
      }),
      execute: async ({ artifactId }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { error } = await sb
          .from("artifacts")
          .update({ status: "deleted" })
          .eq("id", artifactId)
          .eq("org_id", orgId);
        if (error) return { error: "Failed to delete artifact" };
        return { deleted: true, artifactId, message: "Artifact deleted." };
      },
    }),

    // === Expression tool — AI generates dot art inline ===
    express: tool({
      description: "Express an emotion, concept, or visual idea as an animated dot pattern inline in the chat. Use this to visually communicate feelings, reactions, or illustrate concepts with animated dots. The dots will morph and animate to form the described image. Use sparingly for impactful moments — celebrations, greetings, expressing understanding, showing a concept visually.",
      inputSchema: z.object({
        concept: z.string().describe("What to express: 'celebration', 'thinking deeply', 'lightbulb moment', 'heart', 'wave hello', 'thumbs up', 'stars', 'growth', 'connection', 'success', etc."),
        size: z.number().optional().describe("Size in pixels, default 80. Use 60-120."),
        dotCount: z.number().optional().describe("Number of dots, default 24. Use 16-40."),
      }),
      execute: async ({ concept, size: dotSize, dotCount: dots }) => {
        // Use Flash Lite to generate normalized dot coordinates
        try {
          const { generateObject } = await import("ai");
          const { gateway } = await import("@ai-sdk/gateway");
          const { object } = await generateObject({
            model: gateway("google/gemini-3.1-flash-lite-preview"),
            schema: z.object({
              points: z.array(z.object({
                x: z.number().min(0).max(1).describe("X position 0-1"),
                y: z.number().min(0).max(1).describe("Y position 0-1"),
              })).describe("Dot positions forming the image"),
            }),
            prompt: `Generate ${dots ?? 24} dot positions (x,y from 0 to 1) that visually represent "${concept}" when rendered as dots on a canvas. The dots should form a recognizable shape or pattern. Center the image around (0.5, 0.5). Use the full 0-1 range.`,
            maxOutputTokens: 500,
          });
          return {
            type: "dot-expression" as const,
            concept,
            points: object.points,
            size: dotSize ?? 80,
            dotCount: object.points.length,
          };
        } catch {
          return {
            type: "dot-expression" as const,
            concept,
            points: [],
            size: dotSize ?? 80,
            dotCount: 0,
            error: "Could not generate expression",
          };
        }
      },
    }),

    // === Web tools ===
    web_browse: tool({
      description: "Fetch a URL and extract text content. Use to read web pages, docs, articles.",
      inputSchema: z.object({
        url: z.string().describe("Full URL to fetch"),
      }),
      execute: async ({ url }) => {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "Granger/1.0 (AI Assistant)" },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) return { error: `HTTP ${res.status}: ${res.statusText}` };
          const html = await res.text();
          // Strip HTML tags, scripts, styles → plain text
          const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 8000);
          return { url, title: html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? url, content: text, length: text.length };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Fetch failed" };
        }
      },
    }),

    // web_search is defined below (existing tool)

    // === Code artifact tool ===
    write_code: tool({
      description: "Save a code file as an artifact. NOT for charts/visuals — use inline ```html blocks for those.",
      inputSchema: z.object({
        filename: z.string().describe("Filename with extension, e.g. 'setup.sh', 'config.json'"),
        language: z.string().describe("Programming language: typescript, python, bash, html, css, json, yaml, markdown, sql, go, rust, ruby, jsx, tsx"),
        code: z.string().describe("The full code content"),
        description: z.string().optional().describe("Brief description of what this code does"),
      }),
      execute: async (input) => {
        // Save to artifacts table with version 1
        const result = await createArtifact(supabase as never, {
          orgId,
          userId,
          type: "code",
          title: input.filename,
          content: input.code,
          language: input.language,
          description: input.description ?? `${input.language} file: ${input.filename}`,
        });

        const artifactId = "artifactId" in result ? result.artifactId : undefined;

        return {
          filename: input.filename,
          language: input.language,
          code: input.code,
          artifactId,
          message: `Created ${input.filename}. Saved as artifact with version history.`,
        };
      },
    }),

    edit_code: tool({
      description:
        "Edit an existing code artifact. Finds the target text and replaces it, creating a new version. " +
        "Use this to modify code that was previously created with write_code or run_project. " +
        "Returns the updated code so the artifact panel auto-refreshes.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID to edit"),
        targetText: z
          .string()
          .describe("The existing code to find and replace (closest match will be used)"),
        replacement: z.string().describe("The new code to replace it with"),
        editDescription: z
          .string()
          .optional()
          .describe("Brief description of the edit (e.g. 'fix bug in sort function')"),
        filePath: z
          .string()
          .optional()
          .describe("For multi-file artifacts, which file to edit. Defaults to primary file."),
      }),
      execute: async (input) => {
        const sb = supabase as any;

        // Fetch the artifact
        const { data: artifact, error: artErr } = await sb
          .from("artifacts")
          .select("id, title, content, language, current_version, type")
          .eq("id", input.artifactId)
          .eq("org_id", orgId)
          .single();

        if (artErr || !artifact) return { error: artErr?.message ?? "Artifact not found" };

        // For multi-file artifacts, fetch the specific file
        let targetContent = artifact.content ?? "";
        let editingFile: string | null = null;

        if (input.filePath) {
          const { data: fileData } = await sb
            .from("artifact_files")
            .select("file_path, content")
            .eq("artifact_id", input.artifactId)
            .eq("version_number", artifact.current_version)
            .eq("file_path", input.filePath)
            .single();

          if (fileData) {
            targetContent = fileData.content;
            editingFile = fileData.file_path;
          }
        }

        // Find and replace — exact match first, then case-insensitive full match
        let newContent: string;
        const exactIdx = targetContent.indexOf(input.targetText);
        if (exactIdx >= 0) {
          // Exact match — replace first occurrence
          newContent = targetContent.slice(0, exactIdx) + input.replacement + targetContent.slice(exactIdx + input.targetText.length);
        } else {
          // Case-insensitive full match
          const targetLower = input.targetText.toLowerCase();
          const contentLower = targetContent.toLowerCase();
          const fuzzyIdx = contentLower.indexOf(targetLower);
          if (fuzzyIdx >= 0) {
            newContent = targetContent.slice(0, fuzzyIdx) + input.replacement + targetContent.slice(fuzzyIdx + input.targetText.length);
          } else {
            return { error: "Could not find the target text in the artifact. Please provide a more accurate snippet." };
          }
        }

        // Update artifact content for single-file artifacts
        if (!editingFile) {
          await sb.from("artifacts").update({ content: newContent }).eq("id", artifact.id);
        }

        // Build files array for version (include all files, with edited one updated)
        let versionFiles: { path: string; content: string }[] | undefined;
        if (editingFile) {
          const { data: allFiles } = await sb
            .from("artifact_files")
            .select("file_path, content")
            .eq("artifact_id", input.artifactId)
            .eq("version_number", artifact.current_version);

          versionFiles = (allFiles ?? []).map((f: { file_path: string; content: string }) => ({
            path: f.file_path,
            content: f.file_path === editingFile ? newContent : f.content,
          }));
        }

        // Create new version
        await createVersion(sb, {
          artifactId: artifact.id,
          content: editingFile ? undefined : newContent,
          files: versionFiles,
          changeSummary: input.editDescription ?? "Edited code",
          changeType: "ai_edit",
          createdBy: userId,
          createdByAi: true,
        });

        // Return in the same shape as write_code so the panel auto-opens/refreshes
        // Always include `code` so the artifact card renders (even for multi-file, use the edited file content)
        return {
          filename: artifact.title,
          language: artifact.language ?? "text",
          code: newContent,
          artifactId: artifact.id,
          type: artifact.type as string,
          files: versionFiles,
          editDescription: input.editDescription,
          message: `Updated "${artifact.title}"${editingFile ? ` (${editingFile})` : ""}.${input.editDescription ? ` Change: ${input.editDescription}` : ""} New version saved.`,
        };
      },
    }),

    // === Approval query tool ===
    list_approvals: tool({
      description: "List pending approvals. For /approve command.",
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
      description: "Propose write action to EXTERNAL services (Linear, Slack, Gmail, etc.) for approval. Do NOT use this for editing artifacts or documents — use edit_code or edit_document instead.",
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
        "Search the web for current information. Use when the user asks about recent events, needs facts you dont know, wants to look something up, or needs real-time data. Returns results with source citations.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
      }),
      execute: async ({ query }) => {
        try {
          const { generateText } = await import("ai");
          const { gateway } = await import("@/lib/ai/config");

          const result = await generateText({
            model: gateway("perplexity/sonar"),
            prompt: query,
          });

          // Extract sources from provider metadata (Perplexity returns citations)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const providerMeta = result.providerMetadata ?? (result as any).experimental_providerMetadata;
          const perplexityMeta = providerMeta?.perplexity as Record<string, unknown> | undefined;
          const citations = (perplexityMeta?.citations as string[]) ?? [];

          return {
            query,
            result: result.text,
            source: "perplexity/sonar",
            citations: citations.map((url, i) => ({ index: i + 1, url })),
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

        // Append reference files to system prompt context
        const { formatReferenceFilesContext } = await import("@/lib/skills/registry");
        const referenceFiles = Array.isArray(skill.reference_files) ? skill.reference_files : [];
        const refContext = formatReferenceFilesContext(referenceFiles);
        const fullSystemPrompt = skill.system_prompt
          ? `${skill.system_prompt}${refContext}`
          : refContext || undefined;

        return {
          activated: true,
          name: skill.name,
          systemPrompt: fullSystemPrompt,
          tools: skill.tools,
          referenceFiles: referenceFiles.length > 0
            ? referenceFiles.map((f: { name: string; type: string }) => ({ name: f.name, type: f.type }))
            : undefined,
          message: `Skill "${skill.name}" activated. ${skill.description}${referenceFiles.length > 0 ? ` (${referenceFiles.length} reference file${referenceFiles.length > 1 ? "s" : ""} loaded)` : ""}`,
        };
      },
    }),

    // === Document tools ===
    create_document: tool({
      description:
        "Create a new rich-text document artifact. Use when the user asks to write a document, memo, spec, brief, report, or any structured text content. The document will appear in the TipTap editor artifact panel.",
      inputSchema: z.object({
        title: z.string().describe("Document title"),
        content: z
          .string()
          .describe(
            "The full document content in HTML format (use <h1>, <h2>, <p>, <ul>, <li>, <blockquote>, <code> tags)",
          ),
        description: z
          .string()
          .optional()
          .describe("Brief description of the document"),
      }),
      execute: async (input) => {
        // Save to artifacts table with version 1
        const result = await createArtifact(supabase as never, {
          orgId,
          userId,
          type: "document",
          title: input.title,
          content: input.content,
          description: input.description ?? `Document: ${input.title}`,
        });

        const artifactId = "artifactId" in result ? result.artifactId : undefined;

        return {
          documentId: artifactId,
          title: input.title,
          content: input.content,
          description: input.description,
          type: "document" as const,
          artifactId,
          message: `Created document "${input.title}". Saved as artifact with version history.`,
        };
      },
    }),

    edit_document: tool({
      description:
        "Edit an existing document or artifact. Can change the title, replace content sections, or both. Use this for ALL document/artifact modifications — never use propose_action for artifact edits.",
      inputSchema: z.object({
        documentId: z.string().describe("The document/artifact ID to edit"),
        newTitle: z.string().optional().describe("New title for the document (if changing title)"),
        targetText: z
          .string()
          .optional()
          .describe(
            "The existing text to find and replace (does not need to be exact, closest match will be used)",
          ),
        replacement: z.string().optional().describe("The new text to replace it with"),
        editDescription: z
          .string()
          .optional()
          .describe("Brief description of the edit"),
      }),
      execute: async (input) => {
        // Try artifacts table first, fall back to context_items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        let doc: { id: string; title: string; content: string } | null = null;
        let isArtifact = false;

        // Check artifacts table
        const { data: artifactDoc } = await sb
          .from("artifacts")
          .select("id, title, content")
          .eq("id", input.documentId)
          .single();

        if (artifactDoc) {
          doc = { id: artifactDoc.id, title: artifactDoc.title, content: artifactDoc.content ?? "" };
          isArtifact = true;
        } else {
          // Fall back to context_items (for legacy documents)
          const { data: contextDoc } = await sb
            .from("context_items")
            .select("id, title, raw_content")
            .eq("id", input.documentId)
            .eq("org_id", orgId)
            .single();
          if (contextDoc) {
            doc = { id: contextDoc.id, title: contextDoc.title, content: contextDoc.raw_content ?? "" };
          }
        }

        if (!doc) return { error: "Document not found" };

        // Handle title change
        const newTitle = input.newTitle ?? doc.title;
        if (input.newTitle) {
          if (isArtifact) {
            await sb.from("artifacts").update({ title: input.newTitle }).eq("id", doc.id);
          } else {
            await sb.from("context_items").update({ title: input.newTitle }).eq("id", doc.id).eq("org_id", orgId);
          }
        }

        // Handle content replacement (if provided)
        let newContent = doc.content;
        if (input.targetText && input.replacement !== undefined) {
          if (doc.content.includes(input.targetText)) {
            newContent = doc.content.replace(input.targetText, input.replacement);
          } else {
            const targetLower = input.targetText.toLowerCase();
            const contentLower = doc.content.toLowerCase();
            const idx = contentLower.indexOf(targetLower.slice(0, Math.min(50, targetLower.length)));
            if (idx >= 0) {
              const endIdx = idx + input.targetText.length;
              newContent = doc.content.slice(0, idx) + input.replacement + doc.content.slice(Math.min(endIdx, doc.content.length));
            } else {
              newContent = doc.content + "\n\n" + input.replacement;
            }
          }
        }

        // Save content changes + create version
        if (newContent !== doc.content || input.newTitle) {
          if (isArtifact) {
            if (newContent !== doc.content) {
              await sb.from("artifacts").update({ content: newContent }).eq("id", doc.id);
            }
            await createVersion(sb, {
              artifactId: doc.id,
              content: newContent,
              changeSummary: input.editDescription ?? (input.newTitle ? `Renamed to "${input.newTitle}"` : "Edited document"),
              changeType: "ai_edit",
              createdBy: userId,
              createdByAi: true,
            });
          } else if (newContent !== doc.content) {
            await sb.from("context_items").update({ raw_content: newContent }).eq("id", doc.id).eq("org_id", orgId);
          }
        }

        return {
          documentId: doc.id,
          title: newTitle,
          content: newContent,
          type: "document" as const,
          editDescription: input.editDescription,
          message: input.newTitle && input.targetText
            ? `Renamed to "${newTitle}" and edited content.`
            : input.newTitle
              ? `Renamed document to "${newTitle}".`
              : `Updated document "${newTitle}".${input.editDescription ? ` Change: ${input.editDescription}` : ""}`,
        };
      },
    }),

    // === System-wide interview tool (CLIENT-SIDE — no execute) ===
    // This tool has NO execute function, which makes it a client-side tool.
    // The AI calls it, the client renders an interactive UI, and the user's
    // response is sent back via addToolOutput().
    ask_user: tool({
      description:
        "Ask the user one or more structured questions to gather input, preferences, or feedback. " +
        "Use this whenever you need user input before proceeding — e.g. when creating a skill, " +
        "building something new, choosing between options, or gathering requirements. " +
        "The user sees an interactive form above the chat input with buttons for choices " +
        "and text fields for free-form answers. You can ask multiple questions at once.",
      inputSchema: z.object({
        title: z.string().describe("A short heading for the question panel (e.g. 'Skill Configuration', 'Build Options')"),
        description: z.string().optional().describe("Optional context text shown below the title"),
        questions: z.array(
          z.object({
            id: z.string().describe("Unique ID for this question (e.g. 'name', 'framework', 'description')"),
            label: z.string().describe("The question text shown to the user"),
            type: z.enum(["choice", "text", "multiselect"]).describe(
              "choice = single-select buttons, text = free-form input, multiselect = multiple choice checkboxes"
            ),
            options: z.array(z.string()).optional().describe("Options for choice/multiselect types"),
            placeholder: z.string().optional().describe("Placeholder text for text inputs"),
            required: z.boolean().optional().describe("Whether this question must be answered (default true)"),
          })
        ).min(1).describe("The questions to ask — at least one required"),
      }),
      // NO execute function → client-side tool
    }),

    // === Skill creation tool ===
    create_skill: tool({
      description:
        "Create a new custom skill for Granger. Use the ask_user tool first to gather requirements from the user (skill name, description, category, system prompt, tools), then call this tool to save the skill. The skill will be immediately available via its slash command.",
      inputSchema: z.object({
        name: z.string().describe("Human-readable skill name, e.g. 'Sales Coach'"),
        slug: z.string().describe("URL-safe identifier, e.g. 'sales-coach'"),
        description: z.string().describe("One-sentence description of what the skill does"),
        category: z.enum(["productivity", "analysis", "creative", "development", "communication", "general"]).describe("Skill category"),
        system_prompt: z.string().describe("The system prompt that defines this skill's behavior and personality"),
        icon: z.string().optional().describe("Emoji icon for the skill, e.g. '🎯'"),
        slash_command: z.string().optional().describe("Slash command to activate, e.g. '/sales'. Auto-generated from slug if omitted."),
        tools: z.array(z.string()).optional().describe("Tool names this skill should have access to, e.g. ['search_context', 'ask_linear_agent']"),
      }),
      execute: async (input) => {
        const slashCmd = input.slash_command
          ? (input.slash_command.startsWith("/") ? input.slash_command : `/${input.slash_command}`)
          : `/${input.slug}`;

        const toolDefs = (input.tools ?? []).map((t) => ({
          name: t,
          description: t.replace(/_/g, " "),
        }));

        try {
          // Use admin client to bypass RLS
          const { createAdminClient: createAdmin } = await import("@/lib/supabase/server");
          const adminDb = createAdmin();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (adminDb as any)
            .from("skills")
            .insert({
              org_id: orgId,
              slug: input.slug,
              name: input.name,
              description: input.description,
              version: "1.0.0",
              author: null,
              category: input.category,
              icon: input.icon ?? "⚡",
              system_prompt: input.system_prompt,
              tools: toolDefs,
              config: {},
              reference_files: [],
              slash_command: slashCmd,
              is_active: true,
              is_builtin: false,
            })
            .select("id, slug, name")
            .single();

          if (error) {
            if (error.code === "23505") {
              return { error: `A skill with slug "${input.slug}" already exists. Try a different name.` };
            }
            return { error: `Failed to create skill: ${error.message}` };
          }

          return {
            success: true,
            skill_id: data.id,
            name: data.name,
            slug: data.slug,
            slash_command: slashCmd,
            message: `Skill "${data.name}" created successfully! Activate it anytime with ${slashCmd}. You can manage it at /skills.`,
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Failed to create skill" };
        }
      },
    }),

    // === Tool creation via sandbox ===
    create_tool_from_code: tool({
      description:
        "Create a custom tool by generating and testing code in a sandbox. " +
        "Write the tool implementation code, test it with a sample input in the sandbox, " +
        "and if the test passes, save it as a reusable skill. " +
        "Use this after gathering requirements via ask_user.",
      inputSchema: z.object({
        name: z.string().describe("Tool name in snake_case (e.g. 'fetch_weather', 'parse_csv')"),
        description: z.string().describe("What this tool does — shown to the AI when deciding whether to call it"),
        code: z.string().describe("The tool implementation as a Node.js CommonJS module. Must export a function `run(input)` that returns a result object."),
        test_input: z.string().describe("Sample input JSON string to test the tool with (passed to run())"),
        language: z.enum(["javascript", "python"]).optional().describe("Language of the tool code, default javascript"),
        packages: z.array(z.string()).optional().describe("npm/pip packages the tool needs"),
      }),
      execute: async (input) => {
        try {
          const { executeInSandbox } = await import("@/lib/sandbox/execute");

          // Wrap the user's code in a test harness that calls run() with the test input
          const lang = input.language ?? "javascript";
          const testHarness = lang === "python"
            ? `import json\n${input.code}\n\nresult = run(json.loads('''${input.test_input}'''))\nprint(json.dumps(result, default=str))`
            : `${input.code}\n\nconst __input = JSON.parse(${JSON.stringify(input.test_input)});\nconst __result = run(__input);\nPromise.resolve(__result).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.message); process.exit(1); });`;

          const result = await executeInSandbox({
            code: testHarness,
            language: lang === "python" ? "python" : "javascript",
            filename: lang === "python" ? "tool_test.py" : "tool_test.js",
            installPackages: input.packages,
            timeout: 30_000,
          });

          // If test failed, return the error so the agent can iterate
          if (result.exitCode !== 0) {
            return {
              success: false,
              exitCode: result.exitCode,
              stdout: result.stdout.slice(0, 2000),
              stderr: result.stderr.slice(0, 2000),
              message: `Tool test failed with exit code ${result.exitCode}. Fix the code and try again.`,
            };
          }

          // Test passed — save as a skill with the code as a reference file
          const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

          const { createAdminClient: createAdmin } = await import("@/lib/supabase/server");
          const adminDb = createAdmin();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: skill, error: skillErr } = await (adminDb as any)
            .from("skills")
            .insert({
              org_id: orgId,
              name: input.name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
              slug,
              description: input.description,
              icon: "🛠️",
              category: "automation",
              system_prompt: `You have access to the custom tool "${input.name}". ${input.description}. The tool code is attached as a reference file. To execute it, use run_code with the code from the reference file.`,
              tools: [{ name: "run_code", description: "Execute the tool code" }],
              reference_files: [{
                name: `${input.name}.${lang === "python" ? "py" : "js"}`,
                type: lang === "python" ? "text/x-python" : "application/javascript",
                content: input.code,
              }],
              is_active: true,
              is_builtin: false,
              created_by: userId ?? null,
            })
            .select("id, slug, name")
            .single();

          if (skillErr) {
            return {
              success: false,
              testPassed: true,
              stdout: result.stdout.slice(0, 2000),
              error: `Test passed but failed to save skill: ${skillErr.message}`,
            };
          }

          return {
            success: true,
            testPassed: true,
            stdout: result.stdout.slice(0, 2000),
            skill: {
              id: skill.id,
              slug: skill.slug,
              name: skill.name,
            },
            message: `Tool "${input.name}" tested successfully and saved as skill "${skill.name}" (/${slug}). Activate it with /activate ${slug}.`,
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : "Tool creation failed",
          };
        }
      },
    }),

    // === Real skills.sh marketplace search ===
    search_skills_marketplace: tool({
      description:
        "Search the skills.sh marketplace for agent skills. Returns real results with install counts and sources. " +
        "Use when the user asks to find, browse, or search for skills to install.",
      inputSchema: z.object({
        query: z.string().describe("Search query (e.g. 'react', 'testing', 'nextjs', 'security')"),
        limit: z.number().min(1).max(20).optional().describe("Max results to return (default 10)"),
      }),
      execute: async ({ query, limit: maxResults }: { query: string; limit?: number }) => {
        try {
          const res = await fetch(
            `https://skills.sh/api/search?q=${encodeURIComponent(query)}`,
            { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
          );
          if (!res.ok) {
            return { error: `skills.sh search failed: ${res.status}`, query };
          }
          const data = await res.json();
          const skills = (data.skills ?? []).slice(0, maxResults ?? 10);
          return {
            query,
            count: skills.length,
            totalAvailable: data.count ?? skills.length,
            skills: skills.map((s: { name: string; source: string; installs: number; id: string }) => ({
              name: s.name,
              source: s.source,
              installs: s.installs,
              installCommand: `npx skills add ${s.source}`,
              url: `https://skills.sh/s/${s.id}`,
            })),
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Search failed", query };
        }
      },
    }),
  };

  return applyPermissions(allTools, permissions);
}
