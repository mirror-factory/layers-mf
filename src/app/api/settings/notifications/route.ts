import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const DEFAULTS = {
  digest_enabled: true,
  digest_time: "07:00",
  email_on_mention: true,
  email_on_action_item: true,
  email_on_new_context: false,
  weekly_summary: true,
} as const;

const PREF_FIELDS = Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[];

const patchSchema = z
  .object({
    digest_enabled: z.boolean().optional(),
    digest_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "digest_time must be HH:MM format")
      .optional(),
    email_on_mention: z.boolean().optional(),
    email_on_action_item: z.boolean().optional(),
    email_on_new_context: z.boolean().optional(),
    weekly_summary: z.boolean().optional(),
  })
  .strict();

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return new Response("No organization found", { status: 400 });

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .eq("org_id", member.org_id)
    .single();

  if (prefs) {
    const result: Record<string, unknown> = {};
    for (const key of PREF_FIELDS) {
      result[key] = prefs[key];
    }
    return NextResponse.json(result);
  }

  // Create default preferences
  const { data: created, error: insertError } = await supabase
    .from("notification_preferences")
    .insert({ user_id: user.id, org_id: member.org_id })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const result: Record<string, unknown> = {};
  for (const key of PREF_FIELDS) {
    result[key] = created[key];
  }
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return new Response("Unauthorized", { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return new Response("No organization found", { status: 400 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Upsert: update if exists, create with defaults + overrides if not
  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", member.org_id)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("notification_preferences")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("notification_preferences")
      .insert({ user_id: user.id, org_id: member.org_id, ...updates });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
