import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isSuperAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();

  const dayOfWeek = now.getDay();
  const weekOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - weekOffset
  ).toISOString();

  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toISOString();

  // Run all queries in parallel (platform-wide, no org filter)
  const [
    orgsResult,
    usersResult,
    contextResult,
    todayResult,
    weekResult,
    monthResult,
    byModelResult,
    configResult,
  ] = await Promise.all([
    adminDb.from("organizations").select("id", { count: "exact", head: true }),
    adminDb.from("org_members").select("id", { count: "exact", head: true }),
    adminDb.from("context_items").select("id", { count: "exact", head: true }),

    // Today usage
    adminDb
      .from("usage_logs")
      .select("input_tokens, output_tokens, cost_usd, credits_used")
      .gte("created_at", todayStart),

    // This week
    adminDb
      .from("usage_logs")
      .select("input_tokens, output_tokens, cost_usd, credits_used")
      .gte("created_at", weekStart),

    // This month
    adminDb
      .from("usage_logs")
      .select("input_tokens, output_tokens, cost_usd, credits_used")
      .gte("created_at", monthStart),

    // By model (all time)
    adminDb
      .from("usage_logs")
      .select("model, input_tokens, output_tokens, cost_usd"),

    // Platform config for margin
    adminDb
      .from("platform_config")
      .select("key, value")
      .eq("key", "credit_config")
      .single(),
  ]);

  interface UsageRow {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    credits_used: number;
  }

  function aggregatePeriod(rows: UsageRow[] | null) {
    if (!rows || rows.length === 0) {
      return { operations: 0, tokens: 0, cost_usd: 0, credits: 0 };
    }
    return {
      operations: rows.length,
      tokens: rows.reduce(
        (s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0),
        0
      ),
      cost_usd: rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0),
      credits: rows.reduce((s, r) => s + Number(r.credits_used ?? 0), 0),
    };
  }

  const todayStats = aggregatePeriod(todayResult.data);
  const weekStats = aggregatePeriod(weekResult.data);
  const monthStats = aggregatePeriod(monthResult.data);

  // Group by model
  const modelMap = new Map<
    string,
    { operations: number; tokens: number; cost_usd: number }
  >();
  for (const row of byModelResult.data ?? []) {
    const key = row.model ?? "unknown";
    const existing = modelMap.get(key) ?? {
      operations: 0,
      tokens: 0,
      cost_usd: 0,
    };
    existing.operations++;
    existing.tokens += (row.input_tokens ?? 0) + (row.output_tokens ?? 0);
    existing.cost_usd += Number(row.cost_usd ?? 0);
    modelMap.set(key, existing);
  }

  // Total credits used (all time from month data as proxy, could query all)
  const allRows = (monthResult.data ?? []) as UsageRow[];
  const totalCreditsUsed = allRows.reduce(
    (s, r) => s + Number(r.credits_used ?? 0),
    0
  );
  const totalCostUsd = Array.from(modelMap.values()).reduce(
    (s, v) => s + v.cost_usd,
    0
  );

  // Profit margin config
  const creditConfig = configResult.data?.value ?? {};
  const marginPct = creditConfig.profit_margin_pct ?? 40;
  const revenueUsd = totalCostUsd / (1 - marginPct / 100);
  const profitUsd = revenueUsd - totalCostUsd;

  return NextResponse.json({
    totalOrgs: orgsResult.count ?? 0,
    totalUsers: usersResult.count ?? 0,
    totalContextItems: contextResult.count ?? 0,
    totalCreditsUsed,
    totalRevenue: revenueUsd,
    usage: {
      today: todayStats,
      thisWeek: weekStats,
      thisMonth: monthStats,
    },
    byModel: Array.from(modelMap.entries()).map(([model, stats]) => ({
      model,
      ...stats,
    })),
    profitMargin: {
      cost_usd: totalCostUsd,
      revenue_usd: revenueUsd,
      margin_pct: marginPct,
      profit_usd: profitUsd,
    },
  });
}
