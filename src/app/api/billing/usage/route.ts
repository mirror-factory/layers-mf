import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const orgId = member.org_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Week start (Monday)
  const dayOfWeek = now.getDay();
  const weekOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekOffset).toISOString();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Run all queries in parallel
  const [todayResult, weekResult, monthResult, byOperationResult, byModelResult] =
    await Promise.all([
      // Today
      adminDb
        .from("usage_logs")
        .select("input_tokens, output_tokens, cost_usd, credits_used")
        .eq("org_id", orgId)
        .gte("created_at", todayStart),

      // This week
      adminDb
        .from("usage_logs")
        .select("input_tokens, output_tokens, cost_usd, credits_used")
        .eq("org_id", orgId)
        .gte("created_at", weekStart),

      // This month
      adminDb
        .from("usage_logs")
        .select("input_tokens, output_tokens, cost_usd, credits_used")
        .eq("org_id", orgId)
        .gte("created_at", monthStart),

      // By operation (this month)
      adminDb
        .from("usage_logs")
        .select("operation, input_tokens, output_tokens, credits_used")
        .eq("org_id", orgId)
        .gte("created_at", monthStart),

      // By model (this month)
      adminDb
        .from("usage_logs")
        .select("model, input_tokens, output_tokens")
        .eq("org_id", orgId)
        .gte("created_at", monthStart),
    ]);

  interface UsageRow {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    credits_used: number;
  }

  function aggregate(rows: UsageRow[] | null) {
    if (!rows || rows.length === 0) {
      return { total_tokens: 0, total_cost: 0, total_credits: 0, operations: 0 };
    }
    return {
      total_tokens: rows.reduce((sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0),
      total_cost: rows.reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0),
      total_credits: rows.reduce((sum, r) => sum + Number(r.credits_used ?? 0), 0),
      operations: rows.length,
    };
  }

  // Group by operation
  const operationMap = new Map<string, { count: number; tokens: number; credits: number }>();
  for (const row of byOperationResult.data ?? []) {
    const key = row.operation;
    const existing = operationMap.get(key) ?? { count: 0, tokens: 0, credits: 0 };
    existing.count++;
    existing.tokens += (row.input_tokens ?? 0) + (row.output_tokens ?? 0);
    existing.credits += Number(row.credits_used ?? 0);
    operationMap.set(key, existing);
  }

  // Group by model
  const modelMap = new Map<string, { count: number; tokens: number }>();
  for (const row of byModelResult.data ?? []) {
    const key = row.model;
    const existing = modelMap.get(key) ?? { count: 0, tokens: 0 };
    existing.count++;
    existing.tokens += (row.input_tokens ?? 0) + (row.output_tokens ?? 0);
    modelMap.set(key, existing);
  }

  return NextResponse.json({
    today: aggregate(todayResult.data),
    thisWeek: aggregate(weekResult.data),
    thisMonth: aggregate(monthResult.data),
    byOperation: Array.from(operationMap.entries()).map(([operation, stats]) => ({
      operation,
      ...stats,
    })),
    byModel: Array.from(modelMap.entries()).map(([model, stats]) => ({
      model,
      ...stats,
    })),
  });
}
