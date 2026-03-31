import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/mcp/oauth/callback
 * OAuth callback handler for MCP servers.
 * Receives authorization code, exchanges for tokens, stores in mcp_servers.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const errorDescription = searchParams.get("error_description") ?? "OAuth authorization was denied";
    return NextResponse.redirect(
      new URL(`/mcp?error=${encodeURIComponent(errorDescription)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/mcp?error=Missing+authorization+code+or+state", request.url)
    );
  }

  // Parse state — contains serverId and the MCP server's token endpoint
  let stateData: { serverId: string; tokenUrl: string; clientId: string; clientSecret?: string };
  try {
    stateData = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
  } catch {
    return NextResponse.redirect(
      new URL("/mcp?error=Invalid+OAuth+state", request.url)
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Exchange authorization code for access + refresh tokens
  const callbackUrl = new URL("/api/mcp/oauth/callback", request.url).toString();

  try {
    const tokenResponse = await fetch(stateData.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
        client_id: stateData.clientId,
        ...(stateData.clientSecret ? { client_secret: stateData.clientSecret } : {}),
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("OAuth token exchange failed:", errorText);
      return NextResponse.redirect(
        new URL(`/mcp?error=${encodeURIComponent("Token exchange failed")}`, request.url)
      );
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token as string;
    const refreshToken = (tokens.refresh_token as string) ?? null;
    const expiresIn = tokens.expires_in as number | undefined;
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Update the MCP server record with OAuth tokens
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("mcp_servers")
      .update({
        api_key_encrypted: accessToken,
        oauth_refresh_token: refreshToken,
        oauth_expires_at: expiresAt,
        auth_type: "oauth",
        last_connected_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", stateData.serverId);

    if (updateError) {
      console.error("Failed to store OAuth tokens:", updateError);
      return NextResponse.redirect(
        new URL(`/mcp?error=${encodeURIComponent("Failed to save tokens")}`, request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/mcp?success=OAuth+connected+successfully", request.url)
    );
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`/mcp?error=${encodeURIComponent("OAuth connection failed")}`, request.url)
    );
  }
}
