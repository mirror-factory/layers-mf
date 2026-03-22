import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PROFILE } from "@/lib/ditto/profile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

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

  const orgId = member.org_id;

  // 1. Fetch user's Ditto profile
  const { data: profile } = await supabase
    .from("ditto_profiles")
    .select(
      "interests, preferred_sources, priority_topics, confidence"
    )
    .eq("user_id", user.id)
    .single();

  const interests = (profile?.interests as string[] | null) ?? DEFAULT_PROFILE.interests;
  const preferredSources = (profile?.preferred_sources as Record<string, number> | null) ??
    DEFAULT_PROFILE.preferred_sources;
  const priorityTopics = (profile?.priority_topics as string[] | null) ??
    DEFAULT_PROFILE.priority_topics;
  const confidence: number = profile?.confidence ?? 0;

  // 2. Fetch items the user has already clicked or dismissed (to exclude)
  const { data: clickedRows } = await (supabase as AnySupabase)
    .from("user_interactions")
    .select("resource_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .in("interaction_type", ["click", "dismiss"])
    .eq("resource_type", "context_item")
    .not("resource_id", "is", null);

  const excludeIds = new Set<string>(
    (clickedRows ?? [])
      .map((r: { resource_id: string | null }) => r.resource_id)
      .filter(Boolean)
  );

  // 3. Get candidate items
  let candidates: {
    id: string;
    title: string;
    source_type: string;
    content_type: string;
    ingested_at: string;
    description_short: string | null;
  }[];

  if (confidence < 0.1 || interests.length === 0) {
    // Low confidence — just return recent items from any source
    const { data } = await supabase
      .from("context_items")
      .select("id, title, source_type, content_type, ingested_at, description_short")
      .eq("org_id", orgId)
      .eq("status", "ready")
      .order("ingested_at", { ascending: false })
      .limit(20);

    candidates = data ?? [];
  } else {
    // Higher confidence — fetch recent items and score them
    const { data } = await supabase
      .from("context_items")
      .select("id, title, source_type, content_type, ingested_at, description_short")
      .eq("org_id", orgId)
      .eq("status", "ready")
      .order("ingested_at", { ascending: false })
      .limit(50);

    candidates = data ?? [];
  }

  // 4. Filter out already-clicked items
  candidates = candidates.filter((c) => !excludeIds.has(c.id));

  // 5. Score and rank
  const scored = candidates.map((item) => {
    let score = 0.5; // base score

    // Freshness boost — newer items score higher
    const ageMs = Date.now() - new Date(item.ingested_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const freshnessBoost = Math.exp(-0.05 * ageDays); // gentle decay
    score += freshnessBoost * 0.3;

    // Source preference boost
    const sourceScore = preferredSources[item.source_type] ?? 0;
    if (sourceScore > 0) {
      score *= 0.5 + sourceScore; // 0.5x to 1.5x
    }

    // Topic/interest match boost (simple keyword match on title)
    const titleLower = item.title.toLowerCase();
    const descLower = (item.description_short ?? "").toLowerCase();
    const combinedText = `${titleLower} ${descLower}`;
    let topicMatches = 0;

    for (const topic of [...interests, ...priorityTopics]) {
      if (combinedText.includes(topic.toLowerCase())) {
        topicMatches++;
      }
    }
    if (topicMatches > 0) {
      score *= 1 + topicMatches * 0.2; // 20% boost per match
    }

    // Generate reason
    let reason = "Recently added to your knowledge base";
    if (topicMatches > 0 && sourceScore > 0) {
      reason = `Matches your interests and from a preferred source (${item.source_type})`;
    } else if (topicMatches > 0) {
      reason = "Based on your interests and recent searches";
    } else if (sourceScore > 0.5) {
      reason = `From one of your preferred sources (${item.source_type})`;
    } else if (ageDays < 1) {
      reason = "Newly added today";
    }

    return {
      id: item.id,
      title: item.title,
      reason,
      source_type: item.source_type,
      content_type: item.content_type,
      score: Math.round(score * 100) / 100,
      ingested_at: item.ingested_at,
    };
  });

  // Sort by score descending, take top 5
  scored.sort((a, b) => b.score - a.score);
  const suggestions = scored.slice(0, 5);

  return NextResponse.json({ suggestions });
}
