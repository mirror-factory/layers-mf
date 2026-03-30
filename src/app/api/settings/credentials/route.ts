import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_PROVIDERS = new Set(["granola", "linear", "notion"]);

/**
 * POST /api/settings/credentials
 * Upsert a credential (API key) for the authenticated user.
 * Accepts: provider, token
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

  // Look up org membership
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json(
      { error: "No organization found" },
      { status: 400 },
    );
  }

  let body: { provider?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { provider, token } = body;

  if (!provider || !token) {
    return NextResponse.json(
      { error: "Missing provider or token" },
      { status: 400 },
    );
  }

  if (!ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json(
      { error: `Invalid provider: ${provider}. Allowed: ${[...ALLOWED_PROVIDERS].join(", ")}` },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- credentials table pending DB types regeneration
  const { error } = await (supabase as any)
    .from("credentials")
    .upsert(
      {
        org_id: member.org_id,
        user_id: user.id,
        provider,
        token_encrypted: token, // TODO: encrypt with Supabase Vault
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,user_id,provider" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
