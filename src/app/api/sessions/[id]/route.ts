import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateSessionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  goal: z.string().min(1).max(2000).optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
});

export async function GET(
  _request: NextRequest,
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

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, name, goal, status, agent_config, created_at, updated_at, last_agent_run")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .single();

  if (error || !session) {
    return new Response("Session not found", { status: 404 });
  }

  const { data: links } = await supabase
    .from("session_context_links")
    .select("context_item_id, relevance_score, added_by, context_items(id, title, source_type, content_type, description_short)")
    .eq("session_id", id);

  return NextResponse.json({ ...session, context_items: links ?? [] });
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
  const parsed = updateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", member.org_id)
    .select("id, name, goal, status, updated_at")
    .single();

  if (error || !session) {
    return new Response("Session not found", { status: 404 });
  }

  return NextResponse.json(session);
}
