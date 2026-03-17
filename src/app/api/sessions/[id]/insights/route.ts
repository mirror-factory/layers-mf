import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  insightId: z.string().uuid(),
  status: z.enum(["active", "dismissed", "pinned"]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  // Verify session belongs to org
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  // Filter by status (default: active)
  const statusFilter = request.nextUrl.searchParams.get("status");
  let query = supabase
    .from("session_insights")
    .select("id, insight_type, title, description, severity, source_item_ids, related_item_ids, status, dismissed_by, dismissed_at, created_at, metadata")
    .eq("session_id", id)
    .order("created_at", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter || "active");
  }

  const { data: insights, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ insights: insights ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { insightId, status } = parsed.data;

  const updateData: Record<string, unknown> = { status };
  if (status === "dismissed") {
    updateData.dismissed_by = user.id;
    updateData.dismissed_at = new Date().toISOString();
  } else {
    updateData.dismissed_by = null;
    updateData.dismissed_at = null;
  }

  const { data: insight, error } = await supabase
    .from("session_insights")
    .update(updateData)
    .eq("id", insightId)
    .eq("session_id", id)
    .eq("org_id", member.org_id)
    .select("id, insight_type, title, status, dismissed_by, dismissed_at")
    .single();

  if (error || !insight) {
    return new Response("Insight not found", { status: 404 });
  }

  return NextResponse.json(insight);
}
