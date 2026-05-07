import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).single();
  if (!member) return null;
  return { supabase, user, orgId: member.org_id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, orgId } = auth;

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") ?? "0");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: collection, error } = await (supabase as any)
    .from("collections").select("*").eq("id", id).eq("org_id", orgId).single();
  if (error || !collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items, count } = await (supabase as any)
    .from("collection_items")
    .select("context_items(id, title, source_type, content_type, status, ingested_at)", { count: "exact" })
    .eq("collection_id", id)
    .range(offset, offset + limit - 1);

  return NextResponse.json({
    collection,
    items: (items ?? []).map((r: { context_items: unknown }) => r.context_items),
    total: count ?? 0,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, orgId } = auth;

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  for (const key of ["name", "description", "icon", "color", "sort_order", "smart_filter"]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("collections").update(updates).eq("id", id).eq("org_id", orgId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collection: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, orgId } = auth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("collections").delete().eq("id", id).eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
