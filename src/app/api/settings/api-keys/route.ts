import { NextRequest, NextResponse } from "next/server";
import { randomUUID, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function maskKey(key: string): string {
  // sk_live_xxxx...last6
  if (key.length <= 14) return key;
  return key.slice(0, 8) + "..." + key.slice(-6);
}

/**
 * GET /api/settings/api-keys
 * List API keys for the current org (masked).
 */
export async function GET() {
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
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  if (member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- api_keys table not yet in generated types
  const { data: keys, error } = await (supabase as any)
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keys: (keys ?? []).map((k: any) => ({
      id: k.id,
      name: k.name,
      masked_key: k.key_prefix,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
    })),
  });
}

/**
 * POST /api/settings/api-keys
 * Generate a new API key. Returns the full key only once.
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

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  if (member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let name = "Default";
  try {
    const body = await request.json();
    if (body.name && typeof body.name === "string") {
      name = body.name.slice(0, 100);
    }
  } catch {
    // No body or invalid JSON — use default name
  }

  // Generate the key
  const rawKey = `sk_live_${randomUUID().replace(/-/g, "")}`;
  const hashed = hashKey(rawKey);
  const prefix = maskKey(rawKey);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- api_keys table not yet in generated types
  const { data: inserted, error } = await (supabase as any)
    .from("api_keys")
    .insert({
      org_id: member.org_id,
      name,
      key_hash: hashed,
      key_prefix: prefix,
      created_by: user.id,
    })
    .select("id, name, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: inserted.id,
    name: inserted.name,
    key: rawKey, // Only returned once
    created_at: inserted.created_at,
  });
}

/**
 * DELETE /api/settings/api-keys
 * Revoke an API key by id.
 */
export async function DELETE(request: NextRequest) {
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
    .select("org_id, role")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  if (member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let keyId: string;
  try {
    const body = await request.json();
    keyId = body.id;
  } catch {
    return NextResponse.json({ error: "Missing key id" }, { status: 400 });
  }

  if (!keyId || typeof keyId !== "string") {
    return NextResponse.json({ error: "Missing key id" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- api_keys table not yet in generated types
  const { error } = await (supabase as any)
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("org_id", member.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
