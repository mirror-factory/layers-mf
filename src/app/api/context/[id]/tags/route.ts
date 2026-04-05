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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (auth.supabase as any)
    .from("item_tags")
    .select("tags(*)")
    .eq("context_item_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tags: (data ?? []).map((r: { tags: unknown }) => r.tags) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, orgId } = auth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const body = await request.json();
  let tagIds: string[] = body.tag_ids ?? [];

  // Auto-create tags by name if provided
  if (Array.isArray(body.tag_names) && body.tag_names.length) {
    for (const name of body.tag_names) {
      const { data: existing } = await sb
        .from("tags").select("id").eq("org_id", orgId).ilike("name", name.trim()).single();
      if (existing) {
        tagIds.push(existing.id);
      } else {
        const { data: created } = await sb
          .from("tags").insert({ org_id: orgId, name: name.trim(), usage_count: 0 }).select("id").single();
        if (created) tagIds.push(created.id);
      }
    }
  }

  tagIds = [...new Set(tagIds)];
  if (!tagIds.length) return NextResponse.json({ error: "No tags specified" }, { status: 400 });

  const rows = tagIds.map((tag_id) => ({ context_item_id: itemId, tag_id }));
  await sb.from("item_tags").upsert(rows, { onConflict: "context_item_id,tag_id" });

  // Update usage counts
  for (const tagId of tagIds) {
    const { count } = await sb
      .from("item_tags").select("*", { count: "exact", head: true }).eq("tag_id", tagId);
    await sb.from("tags").update({ usage_count: count ?? 0 }).eq("id", tagId);
  }

  return NextResponse.json({ added: tagIds.length }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = auth.supabase as any;

  const { tag_ids } = await request.json();
  if (!Array.isArray(tag_ids) || !tag_ids.length) {
    return NextResponse.json({ error: "tag_ids required" }, { status: 400 });
  }

  await sb.from("item_tags").delete().eq("context_item_id", itemId).in("tag_id", tag_ids);

  // Update usage counts
  for (const tagId of tag_ids) {
    const { count } = await sb
      .from("item_tags").select("*", { count: "exact", head: true }).eq("tag_id", tagId);
    await sb.from("tags").update({ usage_count: count ?? 0 }).eq("id", tagId);
  }

  return new Response(null, { status: 204 });
}
