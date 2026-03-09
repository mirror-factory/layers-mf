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
  source_url: string | null;
  rrf_score: number;
};

export type SearchFilters = {
  sourceType?: string;
  contentType?: string;
  dateFrom?: string; // ISO 8601
  dateTo?: string; // ISO 8601
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export async function searchContext(
  supabase: SupabaseClient<Database>,
  orgId: string,
  query: string,
  limit = 10,
  filters?: SearchFilters
): Promise<SearchResult[]> {
  const db = supabase as AnySupabase;

  if (process.env.AI_GATEWAY_API_KEY) {
    // Hybrid: vector cosine + full-text RRF
    const embedding = await generateEmbedding(query);
    const { data, error } = await db.rpc("hybrid_search", {
      p_org_id: orgId,
      p_query_text: query,
      p_query_embedding: embedding,
      p_limit: limit,
      p_source_type: filters?.sourceType ?? null,
      p_content_type: filters?.contentType ?? null,
      p_date_from: filters?.dateFrom ?? null,
      p_date_to: filters?.dateTo ?? null,
    });
    if (error) throw error;
    return (data ?? []) as SearchResult[];
  } else {
    // Text-only fallback
    const { data, error } = await db.rpc("hybrid_search_text", {
      p_org_id: orgId,
      p_query_text: query,
      p_limit: limit,
      p_source_type: filters?.sourceType ?? null,
      p_content_type: filters?.contentType ?? null,
      p_date_from: filters?.dateFrom ?? null,
      p_date_to: filters?.dateTo ?? null,
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
