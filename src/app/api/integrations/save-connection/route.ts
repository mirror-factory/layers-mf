import { NextRequest, NextResponse } from "next/server";

/**
 * @deprecated This route saved Nango connection IDs which have been removed.
 * MCP servers now connect directly via OAuth PKCE or bearer tokens.
 * Keeping this route to avoid 404s from any lingering client calls.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: "Nango connections have been removed. Use MCP server connections instead." },
    { status: 410 }
  );
}
