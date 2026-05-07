export const metadata = { title: "Library" };
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { LibraryLayerDashboard } from "@/components/library-layer-dashboard";
import { defaultDeweyProfile } from "@/lib/library/domain";

async function safeCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
): Promise<number> {
  const { count, error } = await query;
  return error ? 0 : count ?? 0;
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const adminDb = createAdminClient();
  const { data: member } = await adminDb
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member?.org_id) return null;
  const orgId = member.org_id;
  const libraryDb = adminDb as any;

  const [
    items,
    stacks,
    inbox,
    assets,
    contextPacks,
    mcpServers,
    syncRules,
    approvals,
    recentItemsResult,
    stacksResult,
    mcpServersResult,
    contextPacksResult,
    syncRulesResult,
    inboxItemsResult,
    deweyResult,
  ] = await Promise.all([
    safeCount(libraryDb.from("context_items").select("id", { count: "exact", head: true }).eq("org_id", orgId).is("archived_at", null)),
    safeCount(libraryDb.from("collections").select("id", { count: "exact", head: true }).eq("org_id", orgId)),
    safeCount(libraryDb.from("inbox_items").select("id", { count: "exact", head: true }).eq("org_id", orgId).neq("status", "dismissed")),
    safeCount(libraryDb.from("library_assets").select("id", { count: "exact", head: true }).eq("org_id", orgId)),
    safeCount(libraryDb.from("context_packs").select("id", { count: "exact", head: true }).eq("org_id", orgId)),
    safeCount(libraryDb.from("mcp_servers").select("id", { count: "exact", head: true }).eq("org_id", orgId)),
    safeCount(libraryDb.from("mcp_sync_rules").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("is_active", true)),
    safeCount(libraryDb.from("approval_queue").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending")),
    libraryDb
      .from("context_items")
      .select("id, title, source_type, content_type, library_item_type, status, ingested_at")
      .eq("org_id", orgId)
      .is("archived_at", null)
      .order("ingested_at", { ascending: false })
      .limit(8),
    libraryDb
      .from("collections")
      .select("id, name, description, is_smart")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(12),
    libraryDb
      .from("mcp_servers")
      .select("id, name, is_active, discovered_tools, tool_snapshot, health_status, oauth_status")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(8),
    libraryDb
      .from("context_packs")
      .select("id, name, purpose, visibility, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(6),
    libraryDb
      .from("mcp_sync_rules")
      .select("id, name, is_active, cadence, item_type")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(6),
    libraryDb
      .from("inbox_items")
      .select("id, title, type, priority, source_type, created_at")
      .eq("org_id", orgId)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .limit(4),
    libraryDb
      .from("dewey_profiles")
      .select("name, tone, allowed_tools, approval_policy, save_behavior")
      .eq("org_id", orgId)
      .eq("is_default", true)
      .maybeSingle(),
  ]);

  const defaultProfile = defaultDeweyProfile(orgId);
  const deweyRow = deweyResult.data;

  return (
    <LibraryLayerDashboard
      counts={{
        items,
        stacks,
        inbox,
        assets,
        contextPacks,
        mcpServers,
        syncRules,
        approvals,
      }}
      recentItems={recentItemsResult.data ?? []}
      stacks={stacksResult.data ?? []}
      mcpServers={mcpServersResult.data ?? []}
      contextPacks={contextPacksResult.data ?? []}
      syncRules={syncRulesResult.data ?? []}
      inboxItems={inboxItemsResult.data ?? []}
      dewey={{
        name: deweyRow?.name ?? defaultProfile.name,
        tone: deweyRow?.tone ?? defaultProfile.tone,
        allowedTools: deweyRow?.allowed_tools ?? defaultProfile.allowedTools,
        approvalPolicy: deweyRow?.approval_policy ?? defaultProfile.approvalPolicy,
        saveBehavior: deweyRow?.save_behavior ?? defaultProfile.saveBehavior,
      }}
    />
  );
}
