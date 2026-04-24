import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- initiated_by / schedule_id columns pending DB types regen
  const { data: conversations, error } = await (supabase as any)
    .from("conversations")
    .select("id, title, created_at, updated_at, initiated_by, schedule_id")
    .eq("org_id", member.org_id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(conversations ?? []);
}

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title : null;

  const adminDb = createAdminClient();
  const { data: conversation, error } = await adminDb

    .from("conversations")
    .insert({
      org_id: member.org_id,
      user_id: user.id,
      title,
    })
    .select("id, title, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(conversation, { status: 201 });
}
