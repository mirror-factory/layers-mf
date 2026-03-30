import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/settings/partner
 * Upsert partner_settings for the authenticated user.
 * Accepts: discord_user_id, ai_gateway_key, default_model
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.discord_user_id !== undefined) {
    const discordId = String(body.discord_user_id).trim();
    // Basic validation: Discord IDs are 17-20 digit snowflakes
    if (discordId && !/^\d{17,20}$/.test(discordId)) {
      return NextResponse.json(
        { error: "Invalid Discord User ID format" },
        { status: 400 },
      );
    }
    updates.discord_user_id = discordId || null;
  }

  if (body.ai_gateway_key !== undefined) {
    // TODO: encrypt with Supabase Vault before storing
    updates.ai_gateway_key_encrypted = body.ai_gateway_key || null;
  }

  if (body.default_model !== undefined) {
    updates.default_model = body.default_model || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- partner_settings table pending DB types regeneration
  const { error } = await (supabase as any)
    .from("partner_settings")
    .upsert(
      {
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
