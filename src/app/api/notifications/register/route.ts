import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/notifications/register
 * Saves a push notification device token for the current user.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, platform } = await request.json();
  if (!token || !platform) {
    return NextResponse.json({ error: "Missing token or platform" }, { status: 400 });
  }

  // Upsert device token — one per user+platform combo
  const { error } = await (supabase as any)
    .from("device_tokens")
    .upsert(
      { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: "user_id,platform" }
    );

  if (error) {
    console.error("[notifications] Failed to save token:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
