import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics/usage
 *
 * Aggregated usage analytics from the `agent_runs` table.
 *
 * Query params:
 *   period   — "day" | "week" | "month" (default: "week")
 *   group_by — "model" | "provider" | "user" | "day" (default: "model")
 */
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
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = member.org_id;
  const { searchParams } = new URL(request.url);

  const period = searchParams.get("period") ?? "week";
  const groupBy = searchParams.get("group_by") ?? "model";

  const intervalMap: Record<string, string> = {
    day: "1 day",
    week: "7 days",
    month: "30 days",
  };
  const interval = intervalMap[period] ?? "7 days";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Fetch agent_runs for the period
  const cutoff = new Date();
  if (period === "day") cutoff.setDate(cutoff.getDate() - 1);
  else if (period === "month") cutoff.setDate(cutoff.getDate() - 30);
  else cutoff.setDate(cutoff.getDate() - 7);

  const { data: runs, error: runsError } = await db
    .from("agent_runs")
    .select(
      "id, model, user_id, conversation_id, input_tokens, output_tokens, cache_read_tokens, cost_usd, duration_ms, ttft_ms, tool_calls, created_at"
    )
    .eq("org_id", orgId)
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false })
    .limit(10000);

  if (runsError) {
    console.error("[analytics/usage] query error:", runsError);
    return NextResponse.json(
      { error: "Failed to fetch usage data" },
      { status: 500 }
    );
  }

  interface AgentRun {
    id: string;
    model: string | null;
    user_id: string | null;
    conversation_id: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    cache_read_tokens: number | null;
    cost_usd: number | null;
    duration_ms: number | null;
    ttft_ms: number | null;
    tool_calls: Array<{ name?: string }> | null;
    created_at: string;
  }

  const items: AgentRun[] = runs ?? [];

  // --- Summary ---
  let totalRequests = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  let totalCacheReadTokens = 0;
  let totalDurationMs = 0;
  let totalTtft = 0;
  let durationCount = 0;
  let ttftCount = 0;
  const modelsSet = new Set<string>();
  const conversationsSet = new Set<string>();

  for (const run of items) {
    totalRequests++;
    totalInputTokens += run.input_tokens ?? 0;
    totalOutputTokens += run.output_tokens ?? 0;
    totalCost += run.cost_usd ?? 0;
    totalCacheReadTokens += run.cache_read_tokens ?? 0;

    if (run.duration_ms != null) {
      totalDurationMs += run.duration_ms;
      durationCount++;
    }
    if (run.ttft_ms != null) {
      totalTtft += run.ttft_ms;
      ttftCount++;
    }
    if (run.model) modelsSet.add(run.model);
    if (run.conversation_id) conversationsSet.add(run.conversation_id);
  }

  const totalTokensForCache = totalInputTokens + totalCacheReadTokens;
  const cacheHitRate =
    totalTokensForCache > 0
      ? Math.round((totalCacheReadTokens / totalTokensForCache) * 100)
      : 0;

  const summary = {
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    totalCost: Math.round(totalCost * 100) / 100,
    totalCacheReadTokens,
    cacheHitRate,
    avgDurationMs: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0,
    avgTtft: ttftCount > 0 ? Math.round(totalTtft / ttftCount) : 0,
    modelsUsed: modelsSet.size,
    uniqueConversations: conversationsSet.size,
  };

  // --- By Model ---
  const modelMap = new Map<
    string,
    {
      model: string;
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cost: number;
      totalDuration: number;
      durationCount: number;
    }
  >();

  for (const run of items) {
    const model = run.model ?? "unknown";
    const existing = modelMap.get(model);
    if (existing) {
      existing.requests++;
      existing.inputTokens += run.input_tokens ?? 0;
      existing.outputTokens += run.output_tokens ?? 0;
      existing.cost += run.cost_usd ?? 0;
      if (run.duration_ms != null) {
        existing.totalDuration += run.duration_ms;
        existing.durationCount++;
      }
    } else {
      modelMap.set(model, {
        model,
        requests: 1,
        inputTokens: run.input_tokens ?? 0,
        outputTokens: run.output_tokens ?? 0,
        cost: run.cost_usd ?? 0,
        totalDuration: run.duration_ms ?? 0,
        durationCount: run.duration_ms != null ? 1 : 0,
      });
    }
  }

  const byModel = Array.from(modelMap.values())
    .map((m) => ({
      model: m.model,
      requests: m.requests,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      cost: Math.round(m.cost * 100) / 100,
      avgDuration:
        m.durationCount > 0
          ? Math.round(m.totalDuration / m.durationCount)
          : 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  // --- By Provider ---
  const providerMap = new Map<
    string,
    { provider: string; requests: number; cost: number }
  >();

  for (const run of items) {
    const provider = (run.model ?? "unknown").split("/")[0];
    const existing = providerMap.get(provider);
    if (existing) {
      existing.requests++;
      existing.cost += run.cost_usd ?? 0;
    } else {
      providerMap.set(provider, {
        provider,
        requests: 1,
        cost: run.cost_usd ?? 0,
      });
    }
  }

  const byProvider = Array.from(providerMap.values())
    .map((p) => ({
      ...p,
      cost: Math.round(p.cost * 100) / 100,
    }))
    .sort((a, b) => b.cost - a.cost);

  // --- By Day ---
  const dayMap = new Map<
    string,
    {
      date: string;
      requests: number;
      cost: number;
      inputTokens: number;
      outputTokens: number;
    }
  >();

  for (const run of items) {
    const date = run.created_at ? run.created_at.split("T")[0] : "unknown";
    const existing = dayMap.get(date);
    if (existing) {
      existing.requests++;
      existing.cost += run.cost_usd ?? 0;
      existing.inputTokens += run.input_tokens ?? 0;
      existing.outputTokens += run.output_tokens ?? 0;
    } else {
      dayMap.set(date, {
        date,
        requests: 1,
        cost: run.cost_usd ?? 0,
        inputTokens: run.input_tokens ?? 0,
        outputTokens: run.output_tokens ?? 0,
      });
    }
  }

  const byDay = Array.from(dayMap.values())
    .map((d) => ({
      ...d,
      cost: Math.round(d.cost * 100) / 100,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // --- Top Tools ---
  const toolMap = new Map<string, number>();

  for (const run of items) {
    if (Array.isArray(run.tool_calls)) {
      for (const tc of run.tool_calls) {
        const name = tc.name ?? "unknown";
        toolMap.set(name, (toolMap.get(name) ?? 0) + 1);
      }
    }
  }

  const topTools = Array.from(toolMap.entries())
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    summary,
    byModel,
    byProvider,
    byDay,
    topTools,
    period,
    groupBy,
    interval,
  });
}
