import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const addMemberSchema = z.object({
  user_id: z.string().uuid(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
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
    .eq("id", sessionId)
    .eq("org_id", member.org_id)
    .single();

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  // Fetch session members (table not yet in generated types)
  const { data: members, error } = await (supabase as any)
    .from("session_members")
    .select("id, user_id, role, joined_at")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true }) as { data: { id: string; user_id: string; role: string; joined_at: string }[] | null; error: any };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with emails from admin client
  const admin = createAdminClient();
  const userIds = (members ?? []).map((m) => m.user_id);

  let enriched = members ?? [];
  if (userIds.length > 0) {
    const { data: users } = await admin.auth.admin.listUsers();
    const emailMap = new Map(
      (users?.users ?? []).map((u) => [u.id, u.email]),
    );
    enriched = (members ?? []).map((m) => ({
      ...m,
      email: emailMap.get(m.user_id) ?? null,
    }));
  }

  return NextResponse.json(enriched);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
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
    .eq("id", sessionId)
    .eq("org_id", member.org_id)
    .single();

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  const body = await request.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Verify target user is in the same org
  const { data: targetMember } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("user_id", parsed.data.user_id)
    .eq("org_id", member.org_id)
    .single();

  if (!targetMember) {
    return NextResponse.json(
      { error: "User is not a member of this organization" },
      { status: 400 },
    );
  }

  const { data: sessionMember, error } = await (supabase as any)
    .from("session_members")
    .insert({
      session_id: sessionId,
      user_id: parsed.data.user_id,
    })
    .select("id, user_id, role, joined_at")
    .single() as { data: { id: string; user_id: string; role: string; joined_at: string } | null; error: any };

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "User already a member of this session" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(sessionMember, { status: 201 });
}
