import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/mcp-servers/[id]
 * Toggle active state or update server details.
 */
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

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Allowlist of fields that can be updated
  const ALLOWED_FIELDS = new Set([
    "is_active", "name", "oauth_authorize_url", "oauth_token_url",
    "oauth_client_id", "oauth_client_secret", "api_key_encrypted",
    "error_message", "bearer_token",
  ]);

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Use admin client to bypass RLS
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();

  // Verify user belongs to the server's org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: server } = await (admin as any)
    .from("mcp_servers")
    .select("org_id")
    .eq("id", id)
    .single();

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (admin as any)
    .from("org_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", server.org_id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("mcp_servers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ server: data });
}

/**
 * DELETE /api/mcp-servers/[id]
 * Remove an MCP server.
 */
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

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use admin client to bypass RLS — user is already authenticated above
  const { createAdminClient } = await import("@/lib/supabase/server");
  const admin = createAdminClient();

  // First verify the server belongs to the user's org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: server } = await (admin as any)
    .from("mcp_servers")
    .select("id, org_id")
    .eq("id", id)
    .single();

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // Verify user belongs to this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (admin as any)
    .from("org_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", server.org_id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("mcp_servers")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
