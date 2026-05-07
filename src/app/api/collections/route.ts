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

export async function GET(request: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, orgId } = auth;

  const parentId = request.nextUrl.searchParams.get("parent_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("collections")
    .select("*, collection_items(count)")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true });

  if (parentId) {
    query = query.eq("parent_id", parentId);
  } else {
    query = query.is("parent_id", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collections: data });
}

export async function POST(request: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, orgId } = auth;

  const body = await request.json();
  const { name, description, icon, color, parent_id, is_smart, smart_filter } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Enforce max 3 levels of nesting
  if (parent_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: parent } = await (supabase as any)
      .from("collections").select("id, parent_id").eq("id", parent_id).single();
    if (!parent) return NextResponse.json({ error: "Parent not found" }, { status: 404 });

    if (parent.parent_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: grandparent } = await (supabase as any)
        .from("collections").select("parent_id").eq("id", parent.parent_id).single();
      if (grandparent?.parent_id) {
        return NextResponse.json({ error: "Max 3 levels of nesting" }, { status: 400 });
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("collections")
    .insert({
      org_id: orgId,
      name: name.trim(),
      description: description ?? null,
      icon: icon ?? null,
      color: color ?? null,
      parent_id: parent_id ?? null,
      is_smart: is_smart ?? false,
      smart_filter: smart_filter ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ collection: data }, { status: 201 });
}
