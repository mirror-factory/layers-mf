import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_INTERACTION_TYPES = new Set([
  "search",
  "click",
  "dismiss",
  "star",
  "chat_query",
  "dwell",
  "export",
]);

const VALID_RESOURCE_TYPES = new Set([
  "context_item",
  "search_result",
  "inbox_item",
  "session",
]);

interface InteractionRow {
  id: string;
  org_id: string;
  user_id: string;
  interaction_type: string;
  resource_type: string | null;
  resource_id: string | null;
  query: string | null;
  source_type: string | null;
  content_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, resourceType, resourceId, sourceType, contentType, query, metadata } = body as {
    type?: string;
    resourceType?: string;
    resourceId?: string;
    sourceType?: string;
    contentType?: string;
    query?: string;
    metadata?: Record<string, unknown>;
  };

  if (!type || !VALID_INTERACTION_TYPES.has(type)) {
    return NextResponse.json(
      { error: `Invalid interaction_type. Must be one of: ${[...VALID_INTERACTION_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  if (resourceType && !VALID_RESOURCE_TYPES.has(resourceType)) {
    return NextResponse.json(
      { error: `Invalid resourceType. Must be one of: ${[...VALID_RESOURCE_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  // Non-blocking insert — table not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertPromise = (supabase as any)
    .from("user_interactions")
    .insert({
      org_id: member.org_id,
      user_id: user.id,
      interaction_type: type,
      resource_type: resourceType ?? null,
      resource_id: resourceId ?? null,
      query: query ?? null,
      source_type: sourceType ?? null,
      content_type: contentType ?? null,
      metadata: metadata ?? {},
    });

  // Fire and forget — but still catch errors for logging
  insertPromise.then(({ error }: { error: { message: string } | null }) => {
    if (error) {
      console.error("[interactions] insert failed:", error.message);
    }
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  // Fetch recent interactions (last 30 days, max 200)
  // Table not yet in generated types
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: interactions, error } = await (supabase as any)
    .from("user_interactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("org_id", member.org_id)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(200) as { data: InteractionRow[] | null; error: { message: string } | null };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = interactions ?? [];

  // Compute summary stats
  const totalSearches = items.filter((i) => i.interaction_type === "search").length;
  const totalClicks = items.filter((i) => i.interaction_type === "click").length;

  // Top sources by click count
  const sourceCounts: Record<string, number> = {};
  for (const item of items) {
    if (item.source_type) {
      sourceCounts[item.source_type] = (sourceCounts[item.source_type] ?? 0) + 1;
    }
  }
  const topSources = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top topics from search queries (simple word frequency)
  const wordCounts: Record<string, number> = {};
  const stopWords = new Set(["the", "a", "an", "is", "in", "to", "for", "of", "and", "or", "on", "at", "by", "with"]);
  for (const item of items) {
    if (item.query) {
      const words = item.query
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 2 && !stopWords.has(w));
      for (const word of words) {
        wordCounts[word] = (wordCounts[word] ?? 0) + 1;
      }
    }
  }
  const topTopics = Object.entries(wordCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Active hours distribution
  const hourSet = new Set<number>();
  for (const item of items) {
    hourSet.add(new Date(item.created_at).getHours());
  }
  const activeHours = [...hourSet].sort((a, b) => a - b);

  return NextResponse.json({
    interactions: items,
    summary: {
      totalSearches,
      totalClicks,
      topSources,
      topTopics,
      activeHours,
    },
  });
}
