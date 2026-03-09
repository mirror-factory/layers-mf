import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActionItems, updateActionItemStatus } from "@/lib/db/action-items";

export async function GET(request: NextRequest) {
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

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? undefined;
  const sourceType = searchParams.get("sourceType") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const items = await getActionItems(
    supabase,
    member.org_id,
    { status, sourceType },
    limit,
    offset
  );

  return NextResponse.json(items);
}

export async function PATCH(request: NextRequest) {
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

  const body = await request.json();
  const { contextItemId, actionIndex, status } = body;

  if (!contextItemId || actionIndex === undefined || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["pending", "done", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await updateActionItemStatus(
    supabase,
    member.org_id,
    user.id,
    contextItemId,
    actionIndex,
    status
  );

  return NextResponse.json({ ok: true });
}
