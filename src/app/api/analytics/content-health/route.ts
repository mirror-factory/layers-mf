import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getStalenessInfo,
  type StalenessSeverity,
} from "@/lib/content-lifecycle";

export async function GET() {
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
    return NextResponse.json(
      { error: "No organization found" },
      { status: 400 }
    );
  }

  // Fetch all context items for the org (select only needed columns)
  const { data: items, error } = await supabase
    .from("context_items")
    .select(
      "id, title, source_type, content_type, status, processed_at, ingested_at"
    )
    .eq("org_id", member.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allItems = items ?? [];
  const total = allItems.length;

  // Compute staleness for each item
  const analyzed = allItems.map((item) => {
    const dateRef = item.processed_at ?? item.ingested_at;
    const info = getStalenessInfo(item.content_type, dateRef);
    return { ...item, ...info };
  });

  // Aggregate by freshness
  const byFreshness = { fresh: 0, aging: 0, stale: 0, veryStale: 0 };
  for (const item of analyzed) {
    const key = severityToKey(item.severity);
    byFreshness[key]++;
  }

  // Aggregate by source
  const sourceMap = new Map<
    string,
    { total: number; fresh: number; stale: number; veryStale: number }
  >();
  for (const item of analyzed) {
    const entry = sourceMap.get(item.source_type) ?? {
      total: 0,
      fresh: 0,
      stale: 0,
      veryStale: 0,
    };
    entry.total++;
    if (item.severity === "fresh") entry.fresh++;
    else if (item.severity === "stale") entry.stale++;
    else if (item.severity === "very-stale") entry.veryStale++;
    sourceMap.set(item.source_type, entry);
  }
  const bySource = Array.from(sourceMap.entries()).map(([source, counts]) => ({
    source,
    ...counts,
  }));

  // Aggregate by content type
  const typeMap = new Map<
    string,
    { total: number; fresh: number; stale: number; veryStale: number }
  >();
  for (const item of analyzed) {
    const entry = typeMap.get(item.content_type) ?? {
      total: 0,
      fresh: 0,
      stale: 0,
      veryStale: 0,
    };
    entry.total++;
    if (item.severity === "fresh") entry.fresh++;
    else if (item.severity === "stale") entry.stale++;
    else if (item.severity === "very-stale") entry.veryStale++;
    typeMap.set(item.content_type, entry);
  }
  const byContentType = Array.from(typeMap.entries()).map(([type, counts]) => ({
    type,
    ...counts,
  }));

  // Collect stale items (stale + very-stale), sorted by days descending
  const staleItems = analyzed
    .filter((item) => item.severity === "stale" || item.severity === "very-stale")
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
    .slice(0, 50)
    .map((item) => ({
      id: item.id,
      title: item.title,
      source_type: item.source_type,
      content_type: item.content_type,
      daysSinceUpdate: item.daysSinceUpdate,
    }));

  // Calculate health score
  const errorCount = allItems.filter((item) => item.status === "error").length;
  let healthScore =
    100 -
    byFreshness.aging * 0.5 -
    byFreshness.stale * 1 -
    byFreshness.veryStale * 2 -
    errorCount * 5;
  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  return NextResponse.json({
    total,
    byFreshness,
    bySource,
    byContentType,
    staleItems,
    healthScore,
  });
}

function severityToKey(
  severity: StalenessSeverity
): "fresh" | "aging" | "stale" | "veryStale" {
  switch (severity) {
    case "fresh":
      return "fresh";
    case "aging":
      return "aging";
    case "stale":
      return "stale";
    case "very-stale":
      return "veryStale";
  }
}
