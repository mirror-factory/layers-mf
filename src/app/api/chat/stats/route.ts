import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversation_id");
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversation_id" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runs, error } = await (supabase as any)
    .from("agent_runs")
    .select(
      "id, model, query, step_count, finish_reason, total_input_tokens, total_output_tokens, cache_read_tokens, cache_write_tokens, duration_ms, tool_calls, gateway_cost_usd, step_details, created_at"
    )
    .eq("org_id", member.org_id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[chat/stats] query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }

  // Compute totals across all runs in this conversation
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let totalCostUsd = 0;
  let totalDurationMs = 0;

  for (const run of runs ?? []) {
    totalInputTokens += run.total_input_tokens ?? 0;
    totalOutputTokens += run.total_output_tokens ?? 0;
    totalCacheRead += run.cache_read_tokens ?? 0;
    totalCacheWrite += run.cache_write_tokens ?? 0;
    totalCostUsd += parseFloat(run.gateway_cost_usd ?? "0");
    totalDurationMs += run.duration_ms ?? 0;
  }

  const totalInput = totalInputTokens + totalCacheRead;
  const cacheHitPct = totalInput > 0 ? Math.round((totalCacheRead / totalInput) * 100) : 0;

  return NextResponse.json({
    runs: runs ?? [],
    totals: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadTokens: totalCacheRead,
      cacheWriteTokens: totalCacheWrite,
      costUsd: totalCostUsd,
      durationMs: totalDurationMs,
      cacheHitPct,
    },
  });
}
