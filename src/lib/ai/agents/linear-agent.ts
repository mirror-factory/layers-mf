import { generateText } from "ai";
import { tool } from "ai";
import { z } from "zod";
import { gateway, TASK_MODELS } from "@/lib/ai/config";
import type { LinearApiClient } from "@/lib/api";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

const LINEAR_SYSTEM = `You are a Linear project management specialist within Granger.
You have deep knowledge of Linear's capabilities: issues, projects, cycles, labels, priorities, states, teams, and assignments.
When asked about tasks, issues, or project management, use your tools to query and manage Linear directly.
Be concise. Format issue lists as tables or bullet points with ID, title, status, assignee, priority.`;

export function createLinearTools(
  client: LinearApiClient,
  orgId: string,
  supabase: AnySupabase,
) {
  return {
    list_issues: tool({
      description:
        "List Linear issues with filters (state, assignee, team, priority)",
      inputSchema: z.object({
        state: z
          .string()
          .optional()
          .describe("e.g. 'In Progress', 'Todo', 'Done', 'Backlog'"),
        assignee: z
          .string()
          .optional()
          .describe("Name, email, or 'me'"),
        team: z
          .string()
          .optional()
          .describe("Team key like 'PROD', 'SERV'"),
        priority: z
          .number()
          .optional()
          .describe("1=Urgent, 2=High, 3=Medium, 4=Low"),
        limit: z.number().optional(),
      }),
      execute: async (input) => {
        const issues = await client.listIssues(input);
        return {
          issues: issues.map((i) => ({
            id: i.identifier,
            title: i.title,
            status: i.state?.name,
            assignee: i.assignee?.name,
            priority: i.priority,
            dueDate: i.dueDate,
            url: i.url,
          })),
        };
      },
    }),

    get_issue: tool({
      description:
        "Get details of a specific Linear issue by ID or identifier (e.g. PROD-127)",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const issue = await client.getIssue(id);
        if (!issue) return { error: "Issue not found" };
        return issue;
      },
    }),

    create_issue: tool({
      description:
        "Create a new Linear issue. Routes through approval queue.",
      inputSchema: z.object({
        title: z.string(),
        team: z.string().describe("Team key like 'PROD'"),
        description: z.string().optional(),
        priority: z.number().optional(),
        assignee: z.string().optional(),
      }),
      execute: async (input) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("approval_queue")
          .insert({
            org_id: orgId,
            requested_by_agent: "granger:linear",
            action_type: "create_task",
            target_service: "linear",
            payload: input,
            status: "pending",
            reasoning: `Create Linear issue "${input.title}" in ${input.team}`,
          })
          .select("id")
          .single();
        if (error) return { error: error.message };
        return {
          message: `Proposed: "${input.title}". Waiting for approval.`,
          approval_id: data.id,
        };
      },
    }),

    update_issue: tool({
      description:
        "Update a Linear issue (status, priority, assignee, title). Routes through approval.",
      inputSchema: z.object({
        id: z.string().describe("Issue identifier (e.g. PROD-127)"),
        title: z.string().optional(),
        priority: z.number().optional(),
        state: z.string().optional(),
        assignee: z.string().optional(),
      }),
      execute: async (input) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("approval_queue")
          .insert({
            org_id: orgId,
            requested_by_agent: "granger:linear",
            action_type: "update_task",
            target_service: "linear",
            payload: input,
            status: "pending",
            reasoning: `Update issue ${input.id}: ${Object.entries(input)
              .filter(([k]) => k !== "id")
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")}`,
          })
          .select("id")
          .single();
        if (error) return { error: error.message };
        return {
          message: `Update proposed for ${input.id}. Waiting for approval.`,
          approval_id: data.id,
        };
      },
    }),

    list_teams: tool({
      description:
        "List all Linear teams (needed to know team keys for creating issues)",
      inputSchema: z.object({}),
      execute: async () => {
        const teams = await client.listTeams();
        return { teams };
      },
    }),
  };
}

export async function runLinearAgent(
  query: string,
  client: LinearApiClient,
  orgId: string,
  supabase: AnySupabase,
) {
  const tools = createLinearTools(client, orgId, supabase);
  const { text, steps } = await generateText({
    model: gateway(TASK_MODELS.chat),
    system: LINEAR_SYSTEM,
    prompt: query,
    tools,
    maxSteps: 4,
  });
  return {
    text,
    toolCalls: steps.flatMap((s) => s.toolCalls ?? []),
  };
}
