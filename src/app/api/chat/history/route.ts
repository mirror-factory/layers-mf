import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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

  const sessionId = request.nextUrl.searchParams.get("session_id");

  let query = supabase
    .from("chat_messages")
    .select("id, role, content, model, created_at")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  } else {
    query = query.is("session_id", null);
  }

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert DB rows to UIMessage format
  const messages = (rows ?? []).map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    parts: row.content as { type: string; text?: string }[],
    createdAt: new Date(row.created_at),
  }));

  return NextResponse.json(messages);
}
