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

  let body: {
    is_active?: boolean;
    name?: string;
    oauth_authorize_url?: string;
    oauth_token_url?: string;
    oauth_client_id?: string;
    oauth_client_secret?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.oauth_authorize_url === "string") updates.oauth_authorize_url = body.oauth_authorize_url;
  if (typeof body.oauth_token_url === "string") updates.oauth_token_url = body.oauth_token_url;
  if (typeof body.oauth_client_id === "string") updates.oauth_client_id = body.oauth_client_id;
  if (body.oauth_client_secret !== undefined) updates.oauth_client_secret = body.oauth_client_secret;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("mcp_servers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("mcp_servers")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
