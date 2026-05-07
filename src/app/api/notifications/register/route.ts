import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/notifications/register
 * Saves a push notification device token for the current user.
 * Upserts on (user_id, token) so re-registrations just update the timestamp.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, platform } = await request.json();
  if (!token || !platform) {
    return NextResponse.json(
      { error: "Missing token or platform" },
      { status: 400 },
    );
  }

  if (!["ios", "android", "web"].includes(platform)) {
    return NextResponse.json(
      { error: "Invalid platform" },
      { status: 400 },
    );
  }

  // Get the user's org_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase as any)
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  // Upsert device token -- unique on (user_id, token)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("device_tokens").upsert(
    {
      user_id: user.id,
      org_id: member?.org_id ?? null,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );

  if (error) {
    console.error("[notifications] Failed to save token:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
