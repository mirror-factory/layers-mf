import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();
  if (!member)
    return NextResponse.json({ error: "No organization" }, { status: 400 });

  const orgId = member.org_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Run all counts in parallel
  const [
    membersRes,
    contextRes,
    artifactsRes,
    conversationsRes,
    orgRes,
    usageRes,
    activityRes,
    sourceBreakdownRes,
  ] = await Promise.all([
    // Member count
    sb.from("org_members").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    // Context items count
    sb.from("context_items").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    // Artifacts count
    sb.from("artifacts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    // Conversations count
    sb.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    // Org credit balance
    sb.from("organizations").select("credit_balance").eq("id", orgId).single(),
    // Usage aggregation from agent_runs
    sb
      .from("agent_runs")
      .select("model, total_input_tokens, total_output_tokens")
      .eq("org_id", orgId),
    // Activity feed from audit_log (last 10)
    sb
      .from("audit_log")
      .select("id, action, resource_type, resource_id, user_id, metadata, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
    // Source type breakdown
    sb.from("context_items").select("source_type").eq("org_id", orgId),
  ]);

  // Aggregate usage by model
  const modelBreakdown: Record<string, { runs: number; inputTokens: number; outputTokens: number }> = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  if (usageRes.data) {
    for (const run of usageRes.data) {
      const model = run.model ?? "unknown";
      if (!modelBreakdown[model]) {
        modelBreakdown[model] = { runs: 0, inputTokens: 0, outputTokens: 0 };
      }
      modelBreakdown[model].runs += 1;
      modelBreakdown[model].inputTokens += run.total_input_tokens ?? 0;
      modelBreakdown[model].outputTokens += run.total_output_tokens ?? 0;
      totalInputTokens += run.total_input_tokens ?? 0;
      totalOutputTokens += run.total_output_tokens ?? 0;
    }
  }

  // Aggregate source type counts
  const sourceTypeCounts: Record<string, number> = {};
  if (sourceBreakdownRes.data) {
    for (const item of sourceBreakdownRes.data) {
      const st = item.source_type ?? "unknown";
      sourceTypeCounts[st] = (sourceTypeCounts[st] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    stats: {
      memberCount: membersRes.count ?? 0,
      contextItemCount: contextRes.count ?? 0,
      artifactCount: artifactsRes.count ?? 0,
      conversationCount: conversationsRes.count ?? 0,
    },
    usage: {
      creditBalance: orgRes.data?.credit_balance ?? 0,
      totalInputTokens,
      totalOutputTokens,
      modelBreakdown,
    },
    activity: activityRes.data ?? [],
    storage: sourceTypeCounts,
  });
}
