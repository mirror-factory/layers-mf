import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateNextCron } from "@/lib/cron";
import { getUserTimezone } from "@/lib/timezone";

export async function GET() {
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
  const { data, error } = await (supabase as any)
    .from("scheduled_actions")
    .select("*")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data });
}

export async function POST(request: NextRequest) {
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
  const { name, description, prompt, action_type, target_service, payload, schedule, max_runs, model, email_recipients, email_template } = body;

  if (!name || !schedule) {
    return NextResponse.json(
      { error: "Missing required fields: name, schedule" },
      { status: 400 }
    );
  }

  const timezone = await getUserTimezone(supabase, user.id);
  const nextRun = schedule.startsWith("once:")
    ? schedule.replace("once:", "")
    : calculateNextCron(schedule, timezone);

  // Merge prompt + email config into payload so the cron executor can find them.
  // Persist the timezone used at create time so the executor honors it on each run.
  const mergedPayload = {
    ...(payload ?? {}),
    ...(prompt ? { prompt } : {}),
    ...(model ? { model } : {}),
    ...(email_recipients?.length ? { email_recipients } : {}),
    ...(email_template ? { email_template } : {}),
    timezone,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("scheduled_actions")
    .insert({
      org_id: member.org_id,
      created_by: user.id,
      name,
      description: description ?? prompt ?? null,
      action_type: action_type ?? "custom",
      target_service: target_service ?? null,
      payload: mergedPayload,
      schedule,
      next_run_at: nextRun,
      max_runs: max_runs ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
