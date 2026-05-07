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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: collectionId } = await params;
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, orgId } = auth;

  // Verify collection belongs to org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: col } = await (supabase as any)
    .from("collections").select("id").eq("id", collectionId).eq("org_id", orgId).single();
  if (!col) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  const { item_ids } = await request.json();
  if (!Array.isArray(item_ids) || !item_ids.length) {
    return NextResponse.json({ error: "item_ids required" }, { status: 400 });
  }

  const rows = item_ids.map((item_id: string) => ({
    collection_id: collectionId,
    context_item_id: item_id,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("collection_items").upsert(rows, { onConflict: "collection_id,context_item_id" }).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ added: data.length }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: collectionId } = await params;
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, orgId } = auth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: col } = await (supabase as any)
    .from("collections").select("id").eq("id", collectionId).eq("org_id", orgId).single();
  if (!col) return NextResponse.json({ error: "Collection not found" }, { status: 404 });

  const { item_ids } = await request.json();
  if (!Array.isArray(item_ids) || !item_ids.length) {
    return NextResponse.json({ error: "item_ids required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .in("context_item_id", item_ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
