import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics/costs
 *
 * Queries usage_logs + agent_runs to produce cost/spend analytics,
 * grouped by model, user, or tag over a date range.
 *
 * Query params:
 *   startDate  — ISO date string (default: 30 days ago)
 *   endDate    — ISO date string (default: now)
 *   groupBy    — "model" | "user" | "date" (default: "model")
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

  // Only owners/admins can view cost analytics
  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = member.org_id;
  const { searchParams } = new URL(request.url);

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const startDate = searchParams.get("startDate") ?? defaultStart.toISOString();
  const endDate = searchParams.get("endDate") ?? now.toISOString();
  const groupBy = searchParams.get("groupBy") ?? "model";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Fetch usage_logs for the date range
  const { data: logs, error: logsError } = await db
    .from("usage_logs")
    .select("model, user_id, operation, input_tokens, output_tokens, cost_usd, credits_used, created_at")
    .eq("org_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (logsError) {
    console.error("[analytics/costs] logs query error:", logsError);
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
  }

  interface UsageLog {
    model: string;
    user_id: string | null;
    operation: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    credits_used: number;
    created_at: string;
  }

  const items: UsageLog[] = logs ?? [];

  // Compute totals
  let totalCost = 0;
  let totalTokens = 0;
  let totalCredits = 0;
  let totalOperations = 0;
  for (const log of items) {
    totalCost += log.cost_usd ?? 0;
    totalTokens += (log.input_tokens ?? 0) + (log.output_tokens ?? 0);
    totalCredits += log.credits_used ?? 0;
    totalOperations++;
  }

  // Group data
  type GroupedRow = {
    key: string;
    operations: number;
    tokens: number;
    cost: number;
    credits: number;
  };

  const grouped = new Map<string, GroupedRow>();

  for (const log of items) {
    let key: string;
    if (groupBy === "user") {
      key = log.user_id ?? "unknown";
    } else if (groupBy === "date") {
      key = log.created_at ? log.created_at.split("T")[0] : "unknown";
    } else {
      key = log.model ?? "unknown";
    }

    const existing = grouped.get(key);
    if (existing) {
      existing.operations += 1;
      existing.tokens += (log.input_tokens ?? 0) + (log.output_tokens ?? 0);
      existing.cost += log.cost_usd ?? 0;
      existing.credits += log.credits_used ?? 0;
    } else {
      grouped.set(key, {
        key,
        operations: 1,
        tokens: (log.input_tokens ?? 0) + (log.output_tokens ?? 0),
        cost: log.cost_usd ?? 0,
        credits: log.credits_used ?? 0,
      });
    }
  }

  const breakdown = Array.from(grouped.values()).sort(
    (a, b) => b.cost - a.cost || b.tokens - a.tokens,
  );

  // Fetch credit balance
  let creditBalance: number | null = null;
  try {
    const { data: org } = await db
      .from("organizations")
      .select("credits")
      .eq("id", orgId)
      .single();
    creditBalance = org?.credits ?? null;
  } catch {
    // credits column may not exist
  }

  return NextResponse.json({
    summary: {
      totalCost,
      totalTokens,
      totalCredits,
      totalOperations,
      creditBalance,
      startDate,
      endDate,
    },
    breakdown,
    groupBy,
  });
}
