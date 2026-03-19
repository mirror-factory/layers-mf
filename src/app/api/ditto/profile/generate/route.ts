import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDittoProfile } from "@/lib/ditto/profile";

export async function POST() {
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

  try {
    const profile = await generateDittoProfile(user.id, member.org_id);

    // Fetch the full record with metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fullProfile } = await (supabase as any)
      .from("ditto_profiles")
      .select(
        "interests, preferred_sources, communication_style, detail_level, priority_topics, working_hours, confidence, interaction_count, last_generated_at"
      )
      .eq("user_id", user.id)
      .single();

    return NextResponse.json(fullProfile ?? profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Profile generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
