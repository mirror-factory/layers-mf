import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/artifacts — List artifacts for the current org
 * Query params: type, status, search, limit, offset
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status") ?? "active";
  const search = url.searchParams.get("search");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("artifacts")
    .select("id, type, title, slug, language, framework, current_version, description_oneliner, description_short, tags, categories, total_cost_usd, status, is_pinned, preview_url, created_at, updated_at, last_opened_at")
    .eq("org_id", member.org_id)
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq("type", type);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ artifacts: data ?? [] });
}
