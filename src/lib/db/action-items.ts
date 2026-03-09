import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export type ActionItem = {
  context_item_id: string;
  action_index: number;
  task: string;
  status: "pending" | "done" | "cancelled";
  source_type: string;
  content_type: string;
  source_title: string;
  source_created_at: string | null;
  completed_at: string | null;
};

export type ActionItemFilters = {
  status?: string;
  sourceType?: string;
};

export async function getActionItems(
  supabase: SupabaseClient<Database>,
  orgId: string,
  filters?: ActionItemFilters,
  limit = 100,
  offset = 0
): Promise<ActionItem[]> {
  const db = supabase as AnySupabase;
  const { data, error } = await db.rpc("get_action_items", {
    p_org_id: orgId,
    p_status: filters?.status ?? null,
    p_source_type: filters?.sourceType ?? null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  // Strip surrounding quotes from task (jsonb_array_elements returns quoted strings)
  return ((data ?? []) as ActionItem[]).map((item) => ({
    ...item,
    task: item.task.replace(/^"|"$/g, ""),
  }));
}

export async function updateActionItemStatus(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
  contextItemId: string,
  actionIndex: number,
  newStatus: "pending" | "done" | "cancelled"
): Promise<void> {
  const db = supabase as AnySupabase;
  const { error } = await db
    .from("action_item_status")
    .upsert(
      {
        org_id: orgId,
        context_item_id: contextItemId,
        action_index: actionIndex,
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
        completed_by: newStatus === "done" ? userId : null,
      },
      { onConflict: "context_item_id,action_index" }
    );
  if (error) throw error;
}
