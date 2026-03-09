import { SupabaseClient } from "@supabase/supabase-js";
import type { SearchResult } from "@/lib/db/search";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export async function searchSessionContext(
  supabase: AnySupabase,
  sessionId: string,
  orgId: string,
  query: string,
  limit = 8
): Promise<SearchResult[]> {
  // Get linked context item IDs for this session
  const { data: links, error: linkError } = await supabase
    .from("session_context_links")
    .select("context_item_id")
    .eq("session_id", sessionId);

  if (linkError) throw linkError;
  if (!links || links.length === 0) return [];

  const linkedIds = links.map(
    (l: { context_item_id: string }) => l.context_item_id
  );

  // Text search within linked items only
  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .join(" & ");

  const { data, error } = await supabase
    .from("context_items")
    .select(
      "id, title, description_short, description_long, source_type, content_type"
    )
    .eq("org_id", orgId)
    .in("id", linkedIds)
    .or(
      `title.ilike.%${query}%,description_short.ilike.%${query}%,raw_content.ilike.%${query}%`
    )
    .limit(limit);

  if (error) throw error;

  // Simple relevance scoring based on title match
  return (data ?? []).map((item) => ({
    id: item.id as string,
    title: item.title as string,
    description_short: item.description_short as string | null,
    description_long: item.description_long as string | null,
    source_type: item.source_type as string,
    content_type: item.content_type as string,
    source_url: null,
    rrf_score: (item.title as string)
      .toLowerCase()
      .includes(query.toLowerCase())
      ? 0.05
      : 0.02,
  }));
}
