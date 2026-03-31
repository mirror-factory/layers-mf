import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";

export interface MCPConnection {
  client: MCPClient;
  tools: Record<string, unknown>;
  toolNames: string[];
}

export type AuthType = "bearer" | "oauth" | "none";

export interface MCPServerAuth {
  authType: AuthType;
  apiKey?: string;
  oauthRefreshToken?: string;
  oauthExpiresAt?: string;
  /** Token URL for refreshing OAuth tokens */
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * Refresh an expired OAuth access token using the refresh token.
 * Returns the new access token or null if refresh fails.
 */
export async function refreshOAuthToken(auth: MCPServerAuth): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
} | null> {
  if (!auth.oauthRefreshToken || !auth.tokenUrl || !auth.clientId) {
    return null;
  }

  try {
    const response = await fetch(auth.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: auth.oauthRefreshToken,
        client_id: auth.clientId,
        ...(auth.clientSecret ? { client_secret: auth.clientSecret } : {}),
      }),
    });

    if (!response.ok) return null;

    const tokens = await response.json();
    const expiresIn = tokens.expires_in as number | undefined;

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? auth.oauthRefreshToken,
      expiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Check if an OAuth token has expired (with 60s buffer).
 */
export function isTokenExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  return Date.now() > expiry - 60_000;
}

export async function connectMCPServer(options: {
  url: string;
  apiKey?: string;
  transportType?: "http" | "sse";
  authType?: AuthType;
}): Promise<MCPConnection> {
  const headers: Record<string, string> = {};
  const effectiveAuthType = options.authType ?? (options.apiKey ? "bearer" : "none");

  if (options.apiKey && effectiveAuthType !== "none") {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }

  const client = await createMCPClient({
    transport: {
      type: options.transportType ?? "http",
      url: options.url,
      headers,
    },
  });

  const tools = await client.tools();
  const toolNames = Object.keys(tools);

  return { client, tools, toolNames };
}

export async function testMCPConnection(
  url: string,
  apiKey?: string,
  transportType?: "http" | "sse"
): Promise<{
  success: boolean;
  toolCount: number;
  toolNames: string[];
  error?: string;
}> {
  try {
    const conn = await connectMCPServer({ url, apiKey, transportType });
    const result = {
      success: true,
      toolCount: conn.toolNames.length,
      toolNames: conn.toolNames,
    };
    await conn.client.close();
    return result;
  } catch (err) {
    return {
      success: false,
      toolCount: 0,
      toolNames: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
