import { generateText, Output } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

const InboxItemSchema = z.object({
  title: z.string().describe("Concise inbox item title (max 120 chars)"),
  body: z.string().optional().describe("Brief explanation or context (1-2 sentences)"),
  type: z
    .enum(["action_item", "decision", "mention", "new_context", "overdue"])
    .describe("Item type based on content"),
  priority: z
    .enum(["urgent", "high", "normal", "low"])
    .describe("Priority: urgent=needs immediate action, high=today, normal=this week, low=FYI"),
  context_item_id: z.string().describe("The ID of the source context_item"),
});

export type GeneratedInboxItem = z.infer<typeof InboxItemSchema>;

/**
 * Fetches context items ingested since `since` for a given org.
 */
export async function fetchRecentContextItems(
  supabase: AnySupabase,
  orgId: string,
  since: string
) {
  const { data, error } = await supabase
    .from("context_items")
    .select("id, title, description_short, source_type, content_type, entities")
    .eq("org_id", orgId)
    .eq("status", "ready")
    .gte("ingested_at", since)
    .order("ingested_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetches overdue action items: unread action_item inbox items older than 48h.
 */
export async function fetchOverdueActionItems(
  supabase: AnySupabase,
  orgId: string,
  userId: string
) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("inbox_items")
    .select("id, title, context_item_id, created_at")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("type", "action_item")
    .eq("status", "unread")
    .lt("created_at", cutoff)
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetches existing inbox item context_item_ids for deduplication.
 * Returns a Set of "context_item_id:type" keys.
 */
export async function fetchExistingInboxKeys(
  supabase: AnySupabase,
  orgId: string,
  userId: string,
  contextItemIds: string[]
): Promise<Set<string>> {
  if (contextItemIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("inbox_items")
    .select("context_item_id, type")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .in("context_item_id", contextItemIds);

  if (error) throw error;
  return new Set(
    (data ?? []).map(
      (r: { context_item_id: string; type: string }) => `${r.context_item_id}:${r.type}`
    )
  );
}

/**
 * Uses AI to generate prioritized inbox items from recent context + overdue items.
 * All AI calls go through Vercel AI Gateway only.
 */
export async function generateInboxItemsAI(
  recentItems: { id: string; title: string; description_short: string | null; source_type: string; content_type: string; entities: unknown }[],
  overdueItems: { id: string; title: string; context_item_id: string | null; created_at: string }[]
): Promise<GeneratedInboxItem[]> {
  if (recentItems.length === 0 && overdueItems.length === 0) return [];

  const recentBlock = recentItems
    .map(
      (r) =>
        `- [${r.id}] "${r.title}" (${r.source_type}/${r.content_type})` +
        (r.description_short ? `: ${r.description_short}` : "") +
        (r.entities
          ? `\n  entities: ${JSON.stringify(r.entities)}`
          : "")
    )
    .join("\n");

  const overdueBlock =
    overdueItems.length > 0
      ? overdueItems
          .map(
            (o) =>
              `- "${o.title}" (created ${o.created_at}, context_item_id: ${o.context_item_id ?? "none"})`
          )
          .join("\n")
      : "None";

  const { output } = await generateText({
    model: gateway("anthropic/claude-haiku-4-5-20251001"),
    output: Output.array({ element: InboxItemSchema }),
    prompt: `You are generating prioritized inbox items for a knowledge worker.

## Recent context items (ingested in the last 24h)
${recentBlock || "None"}

## Overdue action items (unread > 48h)
${overdueBlock}

Generate inbox items based on:
1. For each recent context item with action_items or decisions in entities, create inbox items.
2. For overdue action items, create "overdue" type items with "urgent" priority.
3. For new context without action items, create a "new_context" type item with "low" priority.
4. Set context_item_id to the source item's ID.
5. Keep titles concise (max 120 chars). Body should be 1-2 sentences of context.
6. Prioritize: urgent=needs immediate action, high=important today, normal=this week, low=FYI.

Return only items that would be valuable — skip trivial or redundant items.`,
  });

  return (output ?? []) as GeneratedInboxItem[];
}

/**
 * Main orchestrator: generates and inserts inbox items for a single user.
 * Returns the number of items inserted.
 */
export async function generateInboxForUser(
  supabase: AnySupabase,
  orgId: string,
  userId: string,
  since: string
): Promise<number> {
  const [recentItems, overdueItems] = await Promise.all([
    fetchRecentContextItems(supabase, orgId, since),
    fetchOverdueActionItems(supabase, orgId, userId),
  ]);

  if (recentItems.length === 0 && overdueItems.length === 0) return 0;

  const generated = await generateInboxItemsAI(recentItems, overdueItems);
  if (generated.length === 0) return 0;

  // Deduplicate: check which context_item_id + type combos already exist
  const contextItemIds = [
    ...new Set(generated.map((g) => g.context_item_id).filter(Boolean)),
  ];
  const existingKeys = await fetchExistingInboxKeys(
    supabase,
    orgId,
    userId,
    contextItemIds
  );

  const newItems = generated.filter(
    (g) => !existingKeys.has(`${g.context_item_id}:${g.type}`)
  );

  if (newItems.length === 0) return 0;

  const rows = newItems.map((item) => ({
    org_id: orgId,
    user_id: userId,
    context_item_id: item.context_item_id,
    type: item.type,
    title: item.title.slice(0, 255),
    body: item.body ?? null,
    priority: item.priority,
    source_type: "cron",
  }));

  const { error } = await supabase.from("inbox_items").insert(rows);
  if (error) throw error;

  return rows.length;
}
