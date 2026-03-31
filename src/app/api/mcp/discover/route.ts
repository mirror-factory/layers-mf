import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/mcp/discover
 * Server-side proxy for MCP OAuth discovery + dynamic client registration.
 * Avoids CORS issues when the browser can't reach the OAuth server directly.
 */
export async function POST(request: NextRequest) {
  let body: { serverUrl: string; appName?: string; callbackUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { serverUrl, appName, callbackUrl } = body;
  if (!serverUrl) {
    return NextResponse.json({ error: "serverUrl is required" }, { status: 400 });
  }

  try {
    const origin = new URL(serverUrl).origin;

    // Step 1: Discover OAuth metadata
    const discoverRes = await fetch(`${origin}/.well-known/oauth-authorization-server`, {
      headers: { Accept: "application/json" },
    });

    if (!discoverRes.ok) {
      return NextResponse.json({
        error: "OAuth discovery not available at this server",
        status: discoverRes.status,
      }, { status: 422 });
    }

    const meta = await discoverRes.json();
    const authorizeUrl = meta.authorization_endpoint ?? "";
    const tokenUrl = meta.token_endpoint ?? "";
    const registrationEndpoint = meta.registration_endpoint ?? "";

    if (!authorizeUrl) {
      return NextResponse.json({ error: "No authorization_endpoint found" }, { status: 422 });
    }

    // Step 2: Dynamic Client Registration if available
    let clientId = "";
    if (registrationEndpoint) {
      try {
        const regRes = await fetch(registrationEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: appName || "Granger",
            redirect_uris: [callbackUrl || "http://localhost:3000/api/mcp/oauth/callback"],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
          }),
        });
        if (regRes.ok) {
          const regData = await regRes.json();
          clientId = regData.client_id ?? "";
        }
      } catch {
        // Registration failed
      }
    }

    return NextResponse.json({
      authorizeUrl,
      tokenUrl,
      clientId,
      registrationEndpoint,
      scopes: meta.scopes_supported ?? [],
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Discovery failed",
    }, { status: 500 });
  }
}
