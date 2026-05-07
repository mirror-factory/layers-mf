import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
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
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  // Verify the context item belongs to this org
  const { data: item } = await supabase
    .from("context_items")
    .select("id")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Context item not found" }, { status: 404 });
  }

  const body = await request.json();
  const { title, content, change_summary } = body;

  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // Calculate required approvals: ceil(team_size / 2)
  const { count: teamSize } = await supabase
    .from("org_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", member.org_id);

  const requiredApprovals = Math.ceil((teamSize ?? 3) / 2);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposal, error } = await (supabase as any)
    .from("edit_proposals")
    .insert({
      context_item_id: id,
      org_id: member.org_id,
      proposed_by: user.id,
      proposed_title: typeof title === "string" ? title : null,
      proposed_content: content,
      change_summary: typeof change_summary === "string" ? change_summary : null,
      required_approvals: requiredApprovals,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ proposal, required_approvals: requiredApprovals });
}
