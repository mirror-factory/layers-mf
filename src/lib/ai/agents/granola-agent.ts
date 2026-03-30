import { generateText, stepCountIs } from "ai";
import { tool } from "ai";
import { z } from "zod";
import { gateway, TASK_MODELS } from "@/lib/ai/config";
import type { GranolaClient } from "@/lib/api";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

const GRANOLA_SYSTEM = `You are a meeting notes and transcripts specialist within Granger.
You can search Granola meeting recordings, read transcripts, and find discussions by topic or date.
When presenting meeting results, include title, date, attendees, and key highlights.
Be concise and focus on extracting actionable insights from meetings.`;

export function createGranolaTools(
  client: GranolaClient,
  _orgId: string,
  _supabase: AnySupabase,
) {
  return {
    list_meetings: tool({
      description:
        "List recent meetings with optional date filter",
      inputSchema: z.object({
        since: z
          .string()
          .optional()
          .describe("ISO date to search from, e.g. '2026-03-01'"),
        limit: z
          .number()
          .optional()
          .describe("Max meetings to return, default 10"),
      }),
      execute: async (input) => {
        const records = await client.list({
          since: input.since,
          limit: input.limit ?? 10,
        });
        return {
          meetings: records.map((r) => ({
            id: r.source_id,
            title: r.title,
            date: r.source_created_at,
            summary:
              (r.source_metadata as { summary?: string } | undefined)
                ?.summary ?? null,
          })),
        };
      },
    }),

    get_transcript: tool({
      description:
        "Get the full transcript of a specific meeting by ID",
      inputSchema: z.object({
        id: z.string().describe("The Granola note/meeting ID"),
      }),
      execute: async ({ id }) => {
        const record = await client.get(id);
        if (!record) return { error: "Meeting not found" };
        return {
          title: record.title,
          date: record.source_created_at,
          content: record.raw_content,
        };
      },
    }),
  };
}

export async function runGranolaAgent(
  query: string,
  client: GranolaClient,
  orgId: string,
  supabase: AnySupabase,
) {
  const tools = createGranolaTools(client, orgId, supabase);
  const { text, steps } = await generateText({
    model: gateway(TASK_MODELS.chat),
    system: GRANOLA_SYSTEM,
    prompt: query,
    tools,
    stopWhen: stepCountIs(4),
  });
  return {
    text,
    toolCalls: steps.flatMap((s) => s.toolCalls ?? []),
  };
}
