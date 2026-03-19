import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PROFILE } from "@/lib/ditto/profile";

const PatchSchema = z
  .object({
    interests: z.array(z.string()).optional(),
    preferred_sources: z.record(z.number()).optional(),
    communication_style: z.enum(["formal", "casual", "balanced"]).optional(),
    detail_level: z.enum(["brief", "moderate", "detailed"]).optional(),
    priority_topics: z.array(z.string()).optional(),
    working_hours: z
      .object({ start: z.number(), end: z.number() })
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("ditto_profiles")
    .select(
      "interests, preferred_sources, communication_style, detail_level, priority_topics, working_hours, confidence, interaction_count, last_generated_at"
    )
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({
      ...DEFAULT_PROFILE,
      confidence: 0,
      interaction_count: 0,
      last_generated_at: null,
    });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Get org_id from membership
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return new Response("No organization found", { status: 400 });
  }

  // Upsert — allows patching even if no profile exists yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase as any)
    .from("ditto_profiles")
    .upsert(
      {
        user_id: user.id,
        org_id: member.org_id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,org_id" }
    )
    .select(
      "interests, preferred_sources, communication_style, detail_level, priority_topics, working_hours, confidence, interaction_count, last_generated_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
