import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateNextCron } from "@/lib/cron";

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
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member)
    return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await request.json();
  const { status, name, prompt, schedule } = body;

  // Build update object with only provided fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};

  if (status !== undefined) {
    if (!["active", "paused"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be 'active' or 'paused'" },
        { status: 400 }
      );
    }
    updates.status = status;
  }

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    updates.name = name.trim();
  }

  if (prompt !== undefined) {
    updates.description = prompt.trim() || null;
    // Update payload.prompt as well
    // First fetch current payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any)
      .from("scheduled_actions")
      .select("payload")
      .eq("id", id)
      .eq("org_id", member.org_id)
      .single();

    const existingPayload = (current?.payload as Record<string, unknown>) ?? {};
    updates.payload = { ...existingPayload, prompt: prompt.trim() };
  }

  if (schedule !== undefined) {
    if (!schedule.trim()) {
      return NextResponse.json({ error: "Schedule cannot be empty" }, { status: 400 });
    }
    updates.schedule = schedule.trim();
    const nextRun = schedule.startsWith("once:")
      ? schedule.replace("once:", "")
      : calculateNextCron(schedule);
    if (!nextRun && !schedule.startsWith("once:")) {
      return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
    }
    updates.next_run_at = nextRun;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("scheduled_actions")
    .update(updates)
    .eq("id", id)
    .eq("org_id", member.org_id)
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!member)
    return NextResponse.json({ error: "No organization" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("scheduled_actions")
    .delete()
    .eq("id", id)
    .eq("org_id", member.org_id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
