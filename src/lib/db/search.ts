import { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from "@/lib/ai/embed";
import { expandQuery } from "@/lib/ai/query-expansion";
import { Database } from "@/lib/database.types";

export type SearchResult = {
  id: string;
  title: string;
  description_short: string | null;
  description_long: string | null;
  source_type: string;
  content_type: string;
  source_url: string | null;
  source_created_at: string | null;
  rrf_score: number;
  trust_weight: number;
  days_ago: number;
};

export type SearchFilters = {
  sourceType?: string;
  contentType?: string;
  dateFrom?: string; // ISO 8601
  dateTo?: string; // ISO 8601
};

// --- Freshness decay configuration ---

/** Half-life in days: after this many days, freshness factor = 0.5 */
const FRESHNESS_DECAY: Record<string, number> = {
  message: 30, // Slack/Discord: half-life 30 days
  issue: 60, // Linear/GitHub: half-life 60 days
  meeting_transcript: 90, // Meetings: half-life 90 days
  document: 180, // Docs: half-life 180 days
  default: 120, // Everything else: 120 days
};

/** ln(2) ≈ 0.693 — used in exponential decay formula */
const LN2 = 0.693;

function computeDaysAgo(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function computeFreshnessFactor(daysAgo: number, contentType: string): number {
  const halfLife = FRESHNESS_DECAY[contentType] ?? FRESHNESS_DECAY.default;
  return Math.exp(-LN2 * daysAgo / halfLife);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export async function searchContext(
  supabase: SupabaseClient<Database>,
  orgId: string,
  query: string,
  limit = 10,
  filters?: SearchFilters,
  expandQueries = false
): Promise<SearchResult[]> {
  if (expandQueries) {
    const queries = await expandQuery(query);
    if (queries.length > 1) {
      const allResults = await Promise.all(
        queries.map((q) => searchContextSingle(supabase, orgId, q, limit, filters))
      );
      return deduplicateResults(allResults.flat(), limit, (r) => r.id);
    }
  }

  return searchContextSingle(supabase, orgId, query, limit, filters);
}

/** Raw result from the RPC before trust/freshness adjustments */
type RawSearchResult = Omit<SearchResult, "trust_weight" | "days_ago">;

async function searchContextSingle(
  supabase: SupabaseClient<Database>,
  orgId: string,
  query: string,
  limit: number,
  filters?: SearchFilters
): Promise<SearchResult[]> {
  const db = supabase as AnySupabase;

  let rawResults: RawSearchResult[];

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
    rawResults = (data ?? []) as RawSearchResult[];
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
    rawResults = (data ?? []) as RawSearchResult[];
  }

  return applyTrustAndFreshness(db, rawResults, (r) => r.id);
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

// --- Trust weight + freshness post-processing ---

/**
 * Fetch trust_weight and processed_at for context items, then adjust scores.
 * finalScore = rrf_score * trust_weight * freshnessFactor
 * Results are re-sorted by adjusted score.
 */
async function applyTrustAndFreshness<
  T extends { rrf_score: number; content_type: string; source_created_at: string | null },
>(
  db: AnySupabase,
  results: T[],
  getItemId: (r: T) => string
): Promise<(T & { trust_weight: number; days_ago: number })[]> {
  if (results.length === 0) return [];

  // Batch-fetch trust_weight and processed_at for all context items
  const itemIds = [...new Set(results.map(getItemId))];
  const { data: weightRows, error } = await db
    .from("context_items")
    .select("id, trust_weight, processed_at")
    .in("id", itemIds);

  const weightMap = new Map<string, { trust_weight: number; processed_at: string | null }>();
  if (!error && weightRows) {
    for (const row of weightRows as { id: string; trust_weight: number; processed_at: string | null }[]) {
      weightMap.set(row.id, { trust_weight: row.trust_weight, processed_at: row.processed_at });
    }
  }

  const scored = results.map((r) => {
    const itemId = getItemId(r);
    const meta = weightMap.get(itemId);
    const trustWeight = meta?.trust_weight ?? 1.0;
    // Use processed_at for freshness; fall back to source_created_at
    const dateForFreshness = meta?.processed_at ?? r.source_created_at;
    const daysAgo = computeDaysAgo(dateForFreshness);
    const freshnessFactor = computeFreshnessFactor(daysAgo, r.content_type);
    const adjustedScore = r.rrf_score * trustWeight * freshnessFactor;

    return {
      ...r,
      rrf_score: adjustedScore,
      trust_weight: trustWeight,
      days_ago: daysAgo,
    };
  });

  // Re-sort by adjusted score descending
  scored.sort((a, b) => b.rrf_score - a.rrf_score);
  return scored;
}

// --- Chunk-based search (Phase 3: Scale infrastructure) ---

export type ChunkSearchResult = {
  id: string;
  context_item_id: string;
  title: string;
  description_short: string | null;
  parent_content: string;
  source_type: string;
  content_type: string;
  source_url: string | null;
  source_created_at: string | null;
  rrf_score: number;
  trust_weight: number;
  days_ago: number;
};

export async function searchContextChunks(
  supabase: SupabaseClient<Database>,
  orgId: string,
  query: string,
  limit = 10,
  filters?: SearchFilters,
  expandQueries = false
): Promise<ChunkSearchResult[]> {
  if (expandQueries) {
    const queries = await expandQuery(query);
    if (queries.length > 1) {
      const allResults = await Promise.all(
        queries.map((q) => searchContextChunksSingle(supabase, orgId, q, limit, filters))
      );
      return deduplicateResults(allResults.flat(), limit, (r) => r.context_item_id);
    }
  }

  return searchContextChunksSingle(supabase, orgId, query, limit, filters);
}

/** Raw chunk result from the RPC before trust/freshness adjustments */
type RawChunkSearchResult = Omit<ChunkSearchResult, "trust_weight" | "days_ago">;

async function searchContextChunksSingle(
  supabase: SupabaseClient<Database>,
  orgId: string,
  query: string,
  limit: number,
  filters?: SearchFilters
): Promise<ChunkSearchResult[]> {
  const db = supabase as AnySupabase;

  if (!process.env.AI_GATEWAY_API_KEY) {
    // No embedding available — fall back to old search (already applies trust/freshness)
    const oldResults = await searchContextSingle(supabase, orgId, query, limit, filters);
    return oldResults.map((r) => ({
      ...r,
      context_item_id: r.id,
      parent_content: r.description_long ?? r.description_short ?? "",
    }));
  }

  const embedding = await generateEmbedding(query);

  const { data, error } = await db.rpc("hybrid_search_chunks", {
    p_org_id: orgId,
    p_query_text: query,
    p_query_embedding: embedding,
    p_limit: limit,
    p_source_type: filters?.sourceType ?? null,
    p_content_type: filters?.contentType ?? null,
    p_date_from: filters?.dateFrom ?? null,
    p_date_to: filters?.dateTo ?? null,
  });

  if (error) {
    // Fallback to old search if chunks table is empty or function missing
    console.warn("Chunk search failed, falling back:", error.message);
    const oldResults = await searchContextSingle(supabase, orgId, query, limit, filters);
    return oldResults.map((r) => ({
      ...r,
      context_item_id: r.id,
      parent_content: r.description_long ?? r.description_short ?? "",
    }));
  }

  const rawResults = (data ?? []) as RawChunkSearchResult[];
  return applyTrustAndFreshness(db, rawResults, (r) => r.context_item_id);
}

/**
 * Deduplicate merged multi-query results by a key, keeping the highest rrf_score.
 */
function deduplicateResults<T extends { rrf_score: number }>(
  results: T[],
  limit: number,
  getKey: (r: T) => string
): T[] {
  const bestByKey = new Map<string, T>();

  for (const result of results) {
    const key = getKey(result);
    const existing = bestByKey.get(key);
    if (!existing || result.rrf_score > existing.rrf_score) {
      bestByKey.set(key, result);
    }
  }

  return Array.from(bestByKey.values())
    .sort((a, b) => b.rrf_score - a.rrf_score)
    .slice(0, limit);
}

export function buildChunkContextBlock(results: ChunkSearchResult[]): string {
  if (results.length === 0) return "No relevant context found.";
  return results
    .map((r, i) =>
      [
        `[${i + 1}] ${r.title} (${r.source_type} · ${r.content_type})`,
        r.parent_content,
      ].join("\n")
    )
    .join("\n\n---\n\n");
}
