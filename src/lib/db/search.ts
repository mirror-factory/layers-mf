import { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/ai/embed";
import { Database } from "@/lib/database.types";

export type SearchResult = {
  id: string;
  title: string;
  description_short: string | null;
  description_long: string | null;
  source_type: string;
  content_type: string;
  rrf_score: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export async function searchContext(
  supabase: SupabaseClient<Database>,
  orgId: string,
  query: string,
  limit = 8
): Promise<SearchResult[]> {
  const db = supabase as AnySupabase;

  if (process.env.OPENAI_API_KEY) {
    // Hybrid: vector cosine + full-text RRF
    const embedding = await generateEmbedding(query);
    const { data, error } = await db.rpc("search_context_items", {
      p_org_id: orgId,
      p_query_text: query,
      p_query_embedding: embedding,
      p_limit: limit,
    });
    if (error) throw error;
    return (data ?? []) as SearchResult[];
  } else {
    // Text-only fallback
    const { data, error } = await db.rpc("search_context_items_text", {
      p_org_id: orgId,
      p_query_text: query,
      p_limit: limit,
    });
    if (error) throw error;
    return (data ?? []) as SearchResult[];
  }
}

export function buildContextBlock(results: SearchResult[]): string {
  if (results.length === 0) return "No relevant context found.";
  return results
    .map((r, i) =>
      [
        `[${i + 1}] ${r.title} (${r.source_type} · ${r.content_type.replace("_", " ")})`,
        r.description_long ?? r.description_short ?? "(no summary)",
      ].join("\n")
    )
    .join("\n\n");
}
