import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { testMCPConnection } from "@/lib/mcp/connect";

/**
 * GET /api/mcp-servers
 * List all MCP servers for the authenticated user's org.
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
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("mcp_servers")
    .select("id, name, url, transport_type, auth_type, is_active, discovered_tools, last_connected_at, error_message, created_at")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ servers: data ?? [] });
}

/**
 * POST /api/mcp-servers
 * Add a new MCP server. Tests connection first to discover tools.
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
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  let body: { name?: string; url?: string; apiKey?: string; authType?: string; transportType?: "http" | "sse" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, url, apiKey, authType, transportType } = body;

  if (!name || !url) {
    return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  // For OAuth servers, skip testing — save first, auth later
  const isOAuth = authType === "oauth";
  let discoveredTools: string[] = [];

  if (!isOAuth) {
    const testResult = await testMCPConnection(url, apiKey, transportType);
    if (!testResult.success) {
      return NextResponse.json(
        { error: `Connection failed: ${testResult.error}` },
        { status: 422 }
      );
    }
    discoveredTools = testResult.toolNames;
  }

  // Insert server record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("mcp_servers")
    .insert({
      org_id: member.org_id,
      name,
      url,
      api_key_encrypted: apiKey || null,
      auth_type: authType ?? (apiKey ? "bearer" : "none"),
      transport_type: transportType ?? "http",
      is_active: !isOAuth, // OAuth servers start inactive until authenticated
      discovered_tools: discoveredTools.map((t) => ({ name: t })),
      last_connected_at: isOAuth ? null : new Date().toISOString(),
      error_message: isOAuth ? "OAuth authentication required" : null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This URL is already registered for your organization" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ server: data, toolCount: testResult.toolCount }, { status: 201 });
}
