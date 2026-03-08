import { tool } from "ai";
import { z } from "zod";
import { searchSessionContext } from "@/lib/db/session-search";
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

export function createSessionTools(
  supabase: AnySupabase,
  orgId: string,
  sessionId: string
) {
  return {
    search_context: tool({
      description:
        "Search the session's linked knowledge base for relevant documents, meetings, messages, and notes. Only returns results from documents linked to this session.",
      inputSchema: searchContextSchema,
      execute: async ({
        query,
        limit,
      }: z.infer<typeof searchContextSchema>) => {
        const results = await searchSessionContext(
          supabase,
          sessionId,
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
        "Fetch the full text content of a specific document by its ID. Only works for documents linked to this session.",
      inputSchema: getDocumentSchema,
      execute: async ({ id }: z.infer<typeof getDocumentSchema>) => {
        // Verify document is linked to this session
        const { data: link } = await supabase
          .from("session_context_links")
          .select("id")
          .eq("session_id", sessionId)
          .eq("context_item_id", id)
          .single();

        if (!link) return { error: "Document not linked to this session" };

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
