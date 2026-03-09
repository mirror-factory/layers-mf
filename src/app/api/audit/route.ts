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

  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit")) || 50,
    100
  );
  const offset = Math.max(
    Number(request.nextUrl.searchParams.get("offset")) || 0,
    0
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entries, error } = await (supabase as any)
    .from("audit_log")
    .select("id, user_id, action, resource_type, resource_id, metadata, created_at")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(entries ?? []);
}
