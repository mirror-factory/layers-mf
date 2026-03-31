import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** PATCH /api/documents/[id] — Auto-save document content */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const body = await request.json();
  const { content } = body as { content?: string };

  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("context_items")
    .update({
      raw_content: content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", member.org_id)
    .select("id, title")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ saved: true, id: data.id, title: data.title });
}
