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
  if (body.name !== undefined) updates.name = body.name;
  if (body.color !== undefined) updates.color = body.color;
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("tags").update(updates).eq("id", id).eq("org_id", orgId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tag: data });
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
    .from("tags").delete().eq("id", id).eq("org_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}

// POST: Merge this tag into another
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sourceId } = await params;
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, orgId } = auth;

  const { merge_into } = await request.json();
  if (!merge_into) return NextResponse.json({ error: "merge_into is required" }, { status: 400 });
  if (merge_into === sourceId) return NextResponse.json({ error: "Cannot merge into self" }, { status: 400 });

  // Verify both tags belong to org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data: src }, { data: target }] = await Promise.all([
    sb.from("tags").select("id").eq("id", sourceId).eq("org_id", orgId).single(),
    sb.from("tags").select("id").eq("id", merge_into).eq("org_id", orgId).single(),
  ]);
  if (!src || !target) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

  // Move item_tags from source to target (ignore conflicts)
  await sb.from("item_tags").update({ tag_id: merge_into }).eq("tag_id", sourceId);

  // Recount usage for target
  const { count } = await sb
    .from("item_tags").select("*", { count: "exact", head: true }).eq("tag_id", merge_into);
  await sb.from("tags").update({ usage_count: count ?? 0 }).eq("id", merge_into);

  // Delete source tag
  await sb.from("tags").delete().eq("id", sourceId);

  return NextResponse.json({ merged_into: merge_into });
}
