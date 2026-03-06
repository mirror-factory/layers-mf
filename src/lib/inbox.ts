import { SupabaseClient } from "@supabase/supabase-js";
import { Extraction } from "@/lib/ai/extract";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

/**
 * Creates inbox items for all org members based on AI-extracted entities.
 * Called after each context item is processed (upload or Nango sync).
 */
export async function createInboxItems(
  supabase: AnySupabase,
  orgId: string,
  contextItemId: string,
  extraction: Extraction,
  sourceType: string
): Promise<void> {
  const { action_items, decisions } = extraction.entities;
  if (action_items.length === 0 && decisions.length === 0) return;

  const { data: members } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId);

  if (!members || members.length === 0) return;

  const rows: object[] = [];
  for (const { user_id } of members) {
    for (const actionItem of action_items) {
      rows.push({
        org_id: orgId,
        user_id,
        context_item_id: contextItemId,
        type: "action_item",
        title: actionItem.slice(0, 255),
        priority: "high",
        source_type: sourceType,
      });
    }
    for (const decision of decisions) {
      rows.push({
        org_id: orgId,
        user_id,
        context_item_id: contextItemId,
        type: "decision",
        title: decision.slice(0, 255),
        priority: "normal",
        source_type: sourceType,
      });
    }
  }

  if (rows.length > 0) {
    await supabase.from("inbox_items").insert(rows);
  }
}
