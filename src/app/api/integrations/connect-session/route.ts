import { NextResponse } from "next/server";

/**
 * @deprecated This route used Nango connect sessions which have been removed.
 * MCP servers now connect directly via OAuth PKCE or bearer tokens.
 * Keeping this route to avoid 404s from any lingering client calls.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Nango connect sessions have been removed. Use MCP server connections instead." },
    { status: 410 }
  );
}
