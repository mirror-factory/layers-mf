import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchContext, type SearchFilters } from "@/lib/db/search";

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const body = await request.json();
  const query: string = body.query;
  const limit: number = Math.min(Math.max(body.limit ?? 10, 1), 50);
  const filters: SearchFilters | undefined = body.filters;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const results = await searchContext(supabase, member.org_id, query.trim(), limit, filters);

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        title: r.title,
        descriptionShort: r.description_short,
        sourceType: r.source_type,
        contentType: r.content_type,
        relevanceScore: r.rrf_score,
        sourceUrl: r.source_url,
      })),
    });
  } catch (err) {
    console.error("[context/search] Search failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Search failed", detail: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
