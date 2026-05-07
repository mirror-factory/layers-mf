import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/analytics/sandbox-costs
 *
 * Returns sandbox usage aggregated by day or user over a date range.
 *
 * Query params:
 *   startDate — ISO date string (default: 30 days ago)
 *   endDate   — ISO date string (default: now)
 *   groupBy   — "day" | "user" (default: "day")
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

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const startDate =
    searchParams.get("startDate") ?? defaultStart.toISOString();
  const endDate = searchParams.get("endDate") ?? now.toISOString();
  const groupBy = searchParams.get("groupBy") ?? "day";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: rows, error: queryError } = await db
    .from("sandbox_usage")
    .select(
      "user_id, sandbox_id, cpu_ms, memory_mb_seconds, network_ingress_bytes, network_egress_bytes, cost_usd, created_at",
    )
    .eq("org_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (queryError) {
    console.error("[analytics/sandbox-costs] query error:", queryError);
    return NextResponse.json(
      { error: "Failed to fetch sandbox usage" },
      { status: 500 },
    );
  }

  interface UsageRow {
    user_id: string | null;
    sandbox_id: string | null;
    cpu_ms: number;
    memory_mb_seconds: number;
    network_ingress_bytes: number;
    network_egress_bytes: number;
    cost_usd: number;
    created_at: string;
  }

  const items: UsageRow[] = rows ?? [];

  // Compute totals
  let totalCost = 0;
  let totalCpuMs = 0;
  let totalMemoryMbSec = 0;
  let totalEgressBytes = 0;
  let totalExecutions = 0;

  for (const row of items) {
    totalCost += row.cost_usd ?? 0;
    totalCpuMs += row.cpu_ms ?? 0;
    totalMemoryMbSec += row.memory_mb_seconds ?? 0;
    totalEgressBytes += row.network_egress_bytes ?? 0;
    totalExecutions++;
  }

  // Group data
  interface GroupedRow {
    key: string;
    executions: number;
    cpuMs: number;
    memoryMbSeconds: number;
    egressBytes: number;
    cost: number;
  }

  const grouped = new Map<string, GroupedRow>();

  for (const row of items) {
    const key =
      groupBy === "user"
        ? (row.user_id ?? "unknown")
        : row.created_at
          ? row.created_at.split("T")[0]
          : "unknown";

    const existing = grouped.get(key);
    if (existing) {
      existing.executions += 1;
      existing.cpuMs += row.cpu_ms ?? 0;
      existing.memoryMbSeconds += row.memory_mb_seconds ?? 0;
      existing.egressBytes += row.network_egress_bytes ?? 0;
      existing.cost += row.cost_usd ?? 0;
    } else {
      grouped.set(key, {
        key,
        executions: 1,
        cpuMs: row.cpu_ms ?? 0,
        memoryMbSeconds: row.memory_mb_seconds ?? 0,
        egressBytes: row.network_egress_bytes ?? 0,
        cost: row.cost_usd ?? 0,
      });
    }
  }

  const breakdown = Array.from(grouped.values()).sort((a, b) =>
    groupBy === "day" ? a.key.localeCompare(b.key) : b.cost - a.cost,
  );

  return NextResponse.json({
    summary: {
      totalCost,
      totalCpuMs,
      totalMemoryMbSec,
      totalEgressBytes,
      totalExecutions,
      startDate,
      endDate,
    },
    breakdown,
    groupBy,
  });
}
