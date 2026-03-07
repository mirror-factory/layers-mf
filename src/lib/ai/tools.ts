import { tool } from "ai";
import { z } from "zod";
import { searchContext } from "@/lib/db/search";
import { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

const searchContextSchema = z.object({
  query: z.string().describe("The search query"),
  limit: z.number().min(1).max(20).describe("Maximum results").optional(),
});

const getDocumentSchema = z.object({
  id: z.string().describe("The document ID from search_context results"),
});

export function createTools(supabase: AnySupabase, orgId: string) {
  return {
    search_context: tool({
      description:
        "Search the team knowledge base for relevant documents, meetings, messages, and notes. Call this first to find what context exists before answering.",
      inputSchema: searchContextSchema,
      execute: async ({ query, limit }: z.infer<typeof searchContextSchema>) => {
        const results = await searchContext(
          supabase as Parameters<typeof searchContext>[0],
          orgId,
          query,
          limit ?? 8
        );
        return results.map((r) => ({
          id: r.id,
          title: r.title,
          source_type: r.source_type,
          content_type: r.content_type,
          rrf_score: r.rrf_score,
          description_short: r.description_short,
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
          .select("id, title, raw_content, source_type, content_type")
          .eq("id", id)
          .eq("org_id", orgId)
          .single();
        if (error || !data) return { error: "Document not found" };
        const item = data as {
          title: string;
          raw_content: string | null;
          source_type: string;
          content_type: string;
        };
        return {
          title: item.title,
          content: item.raw_content ?? "(no content available)",
          source_type: item.source_type,
          content_type: item.content_type,
        };
      },
    }),
  };
}
