import { generateText } from "ai";
import { tool } from "ai";
import { z } from "zod";
import { gateway, TASK_MODELS } from "@/lib/ai/config";
import type { NotionClient } from "@/lib/api";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

const NOTION_SYSTEM = `You are a Notion specialist within Granger.
You can search pages and databases, read page content, and query databases.
You understand Notion's structure: workspaces contain pages and databases. Pages have blocks of content.
Format results clearly with page titles, types, and last edited dates.`;

export function createNotionTools(
  client: NotionClient,
  orgId: string,
  _supabase: AnySupabase,
) {
  void orgId; // reserved for future approval-gated write tools

  return {
    search_pages: tool({
      description:
        "Search Notion pages and databases shared with the integration",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Search query text"),
        limit: z
          .number()
          .optional()
          .describe("Max results, default 10"),
      }),
      execute: async (input) => {
        const results = await client.search(
          input.query,
          input.limit ?? 10,
        );
        return {
          pages: results.map((r) => ({
            id: r.id,
            title: r.title,
            type: r.object,
            lastEdited: r.last_edited_time,
            url: r.url,
          })),
        };
      },
    }),

    read_page: tool({
      description:
        "Read the full content of a Notion page by ID",
      inputSchema: z.object({
        id: z.string().describe("The Notion page ID"),
      }),
      execute: async ({ id }) => {
        const content = await client.getPageContent(id);
        if (!content) return { error: "Page not found or empty" };
        return { content: content.slice(0, 8000) };
      },
    }),
  };
}

export async function runNotionAgent(
  query: string,
  client: NotionClient,
  orgId: string,
  supabase: AnySupabase,
) {
  const tools = createNotionTools(client, orgId, supabase);
  const { text, steps } = await generateText({
    model: gateway(TASK_MODELS.chat),
    system: NOTION_SYSTEM,
    prompt: query,
    tools,
    maxSteps: 4,
  });
  return {
    text,
    toolCalls: steps.flatMap((s) => s.toolCalls ?? []),
  };
}
