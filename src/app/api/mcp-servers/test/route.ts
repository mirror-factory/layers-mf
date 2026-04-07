import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { testMCPConnection } from "@/lib/mcp/connect";

/**
 * POST /api/mcp-servers/test
 * Test an MCP connection without saving it.
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

  let body: { url?: string; apiKey?: string; transportType?: "http" | "sse" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    new URL(body.url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const result = await testMCPConnection(body.url, body.apiKey, body.transportType);
  // Include requiresOAuth in response so the client can suggest switching to OAuth
  return NextResponse.json(result);
}
