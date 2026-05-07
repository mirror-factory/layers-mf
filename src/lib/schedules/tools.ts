import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { searchContext, searchContextChunks } from "@/lib/db/search";
import { createTools } from "@/lib/ai/tools";

export type ToolTier = "minimal" | "standard" | "full";

/** Step limits per tier */
export const STEP_LIMITS: Record<ToolTier, number> = {
  minimal: 5,
  standard: 10,
  full: 20,
};

/**
 * Build a minimal tool set for scheduled runs.
 * Only search_context is included to keep background jobs predictable.
 */
export function createScheduleTools(supabase: ReturnType<typeof createAdminClient>, orgId: string) {
  return {
    search_context: tool({
      description: "Search the organization's knowledge base for documents, meetings, notes, and other context.",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
        limit: z.number().min(1).max(20).optional().describe("Maximum results (default 8)"),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        const chunkResults = await searchContextChunks(
          supabase as Parameters<typeof searchContextChunks>[0],
          orgId,
          query,
          limit ?? 8,
          undefined,
          true,
        );

        if (chunkResults.length > 0) {
          return {
            results: chunkResults.map((result) => ({
              title: result.title,
              snippet: result.parent_content?.slice(0, 500) ?? result.description_short ?? "",
              source_type: result.source_type,
              content_type: result.content_type,
            })),
          };
        }

        const results = await searchContext(
          supabase as Parameters<typeof searchContext>[0],
          orgId,
          query,
          limit ?? 8,
        );

        return {
          results: results.map((result) => ({
            title: result.title,
            snippet: result.description_short ?? result.description_long?.slice(0, 500) ?? "",
            source_type: result.source_type,
            content_type: result.content_type,
          })),
        };
      },
    }),
  };
}

/**
 * Build tool sets based on tier.
 *
 * - minimal: search_context only
 * - standard: search + artifact + web/code tools
 * - full: all tools from createTools, including sandbox and MCP actions
 */
export function createScheduleToolsByTier(
  tier: ToolTier,
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string,
) {
  if (tier === "minimal") {
    return createScheduleTools(supabase, orgId);
  }

  if (tier === "full") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createTools(supabase as any, orgId, userId);
  }

  const baseTools = createScheduleTools(supabase, orgId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fullTools = createTools(supabase as any, orgId, userId);

  const standardToolNames = [
    "artifact_list",
    "artifact_get",
    "write_code",
    "edit_code",
    "web_browse",
    "web_search",
  ] as const;

  const standardExtras: Record<string, unknown> = {};
  for (const name of standardToolNames) {
    if (name in fullTools) {
      standardExtras[name] = fullTools[name as keyof typeof fullTools];
    }
  }

  return { ...baseTools, ...standardExtras };
}
