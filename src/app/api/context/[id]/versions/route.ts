import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  // Verify the context item belongs to the user's org
  const { data: item } = await supabase
    .from("context_items")
    .select("id")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: versions, error } = await supabase
    .from("context_item_versions")
    .select(
      "version_number, title, change_type, changed_fields, changed_by, created_at, raw_content",
    )
    .eq("context_item_id", id)
    .eq("org_id", member.org_id)
    .order("version_number", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }

  const mapped = (versions ?? []).map((v) => ({
    version_number: v.version_number,
    title: v.title,
    change_type: v.change_type,
    changed_fields: v.changed_fields ?? [],
    changed_by: v.changed_by,
    created_at: v.created_at,
    content_preview: v.raw_content ? v.raw_content.slice(0, 200) : null,
  }));

  return NextResponse.json({ versions: mapped, total: mapped.length });
}
