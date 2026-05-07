import { generateObject } from "ai";
import { z } from "zod";
import { extractionModel } from "./config";
import { logUsage } from "./usage";
import { createAdminClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = import("@supabase/supabase-js").SupabaseClient<any>;

export const ConnectionSchema = z.object({
  connections: z.array(
    z.object({
      type: z.enum([
        "supports",
        "contradicts",
        "extends",
        "updates",
        "depends_on",
      ]),
      item_a_id: z.string(),
      item_b_id: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      severity: z.enum(["info", "important", "critical"]),
    })
  ),
});

export type Connection = z.infer<typeof ConnectionSchema>["connections"][number];

const CONFIDENCE_THRESHOLD = 0.3;

/**
 * Find connections between a new item and existing items from different sources.
 * Uses embedding similarity to find candidates, then AI to analyze relationships.
 */
export async function findCrossSourceConnections(
  newItemId: string,
  orgId: string,
  opts?: { maxCandidates?: number; supabase?: AnySupabase }
): Promise<Connection[]> {
  const supabase = opts?.supabase ?? (createAdminClient() as AnySupabase);
  const maxCandidates = opts?.maxCandidates ?? 5;

  // 1. Fetch the new item's content and embedding
  const { data: newItem, error: fetchError } = await supabase
    .from("context_items")
    .select(
      "id, title, raw_content, source_type, content_type, embedding, description_short"
    )
    .eq("id", newItemId)
    .eq("org_id", orgId)
    .single();

  if (fetchError || !newItem) {
    console.warn("Cross-source: item not found", newItemId);
    return [];
  }

  if (!newItem.embedding) {
    console.warn("Cross-source: item has no embedding", newItemId);
    return [];
  }

  // 2. Search for similar items from OTHER source types
  const { data: candidates, error: searchError } = await supabase.rpc(
    "match_context_items_cross_source",
    {
      p_org_id: orgId,
      p_embedding: newItem.embedding,
      p_exclude_source_type: newItem.source_type,
      p_exclude_item_id: newItemId,
      p_limit: maxCandidates,
    }
  );

  // Fallback: if the RPC doesn't exist, do a manual similarity search
  if (searchError) {
    console.warn(
      "Cross-source RPC failed, falling back to manual search:",
      searchError.message
    );
    return findCrossSourceConnectionsFallback(
      supabase,
      newItem,
      orgId,
      maxCandidates
    );
  }

  if (!candidates || candidates.length === 0) {
    return [];
  }

  // 3. Use AI to analyze relationships between the new item and each candidate
  return analyzeConnections(supabase, newItem, candidates, orgId);
}

/**
 * Fallback when the cross-source RPC doesn't exist.
 * Fetches recent items from other sources and lets AI determine connections.
 */
async function findCrossSourceConnectionsFallback(
  supabase: AnySupabase,
  newItem: {
    id: string;
    title: string;
    raw_content: string | null;
    source_type: string;
    description_short: string | null;
  },
  orgId: string,
  maxCandidates: number
): Promise<Connection[]> {
  const { data: candidates } = await supabase
    .from("context_items")
    .select("id, title, raw_content, source_type, content_type, description_short")
    .eq("org_id", orgId)
    .eq("status", "ready")
    .neq("source_type", newItem.source_type)
    .neq("id", newItem.id)
    .order("processed_at", { ascending: false })
    .limit(maxCandidates);

  if (!candidates || candidates.length === 0) {
    return [];
  }

  return analyzeConnections(supabase, newItem, candidates, orgId);
}

/**
 * Use AI to analyze the relationship between a new item and candidate items.
 */
async function analyzeConnections(
  supabase: AnySupabase,
  newItem: {
    id: string;
    title: string;
    raw_content: string | null;
    source_type: string;
    description_short: string | null;
  },
  candidates: Array<{
    id: string;
    title: string;
    raw_content?: string | null;
    source_type: string;
    content_type?: string;
    description_short?: string | null;
  }>,
  orgId: string
): Promise<Connection[]> {
  const newItemPreview =
    newItem.description_short ??
    (newItem.raw_content ?? "").slice(0, 500);

  const candidateSummaries = candidates
    .map(
      (c, i) =>
        `Candidate ${i + 1} (ID: ${c.id}, source: ${c.source_type}):\nTitle: ${c.title}\n${c.description_short ?? (c.raw_content ?? "").slice(0, 500)}`
    )
    .join("\n\n");

  try {
    const result = await generateObject({
      model: extractionModel,
      schema: ConnectionSchema,
      prompt: `You are analyzing relationships between content items from different sources in a team knowledge base.

New Item (ID: ${newItem.id}, source: ${newItem.source_type}):
Title: ${newItem.title}
${newItemPreview}

Compare with these candidates from OTHER sources:

${candidateSummaries}

For each candidate, determine if there is a genuine connection to the new item.
Possible connection types:
- "supports": Items reinforce or agree with each other
- "contradicts": Items contain conflicting information, dates, or decisions
- "extends": One item builds upon or adds detail to the other
- "updates": One item supersedes or updates information in the other
- "depends_on": One item references a dependency or prerequisite from the other

Rate confidence (0-1) and severity:
- "info": Nice to know, contextual link
- "important": Team should be aware of this connection
- "critical": Contradiction or conflict that needs resolution

Only report genuine, meaningful connections. If items are unrelated, return an empty connections array.
Use the actual item IDs provided above (item_a_id = new item, item_b_id = candidate).`,
    });

    logUsage({
      orgId,
      operation: "cross_source_analysis",
      model: "google/gemini-3.1-flash-lite-preview",
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      metadata: { newItemId: newItem.id, candidateCount: candidates.length },
    });

    // Filter out low-confidence connections
    return result.object.connections.filter(
      (c) => c.confidence >= CONFIDENCE_THRESHOLD
    );
  } catch (error) {
    console.error("Cross-source AI analysis failed:", error);
    return [];
  }
}
