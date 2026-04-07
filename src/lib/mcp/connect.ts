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

  // Try all transport + protocol version combinations until one works
  // Order: http (latest) → http (older versions) → sse (latest) → sse (older versions)
  const transports: ("http" | "sse")[] = options.transportType
    ? [options.transportType]
    : ["http", "sse"];
  const protocolVersions = [undefined, "2025-06-18", "2025-03-26", "2024-11-05"];

  let client;
  let lastError: Error | null = null;
  const attempts: string[] = [];

  for (const transport of transports) {
    for (const version of protocolVersions) {
      const config = { type: transport, url: options.url, headers };
      const label = `${transport}${version ? `@${version}` : "@latest"}`;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opts: any = { transport: config };
        if (version) opts.protocolVersion = version;
        client = await createMCPClient(opts);
        console.log(`[mcp] Connected via ${label} to ${options.url}`);
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempts.push(`${label}: ${lastError.message.slice(0, 80)}`);
        // Only retry protocol versions if the error is about protocol
        if (!lastError.message.includes("protocol") && !lastError.message.includes("Unsupported") && version) {
          break; // non-protocol error on this transport, skip remaining versions
        }
      }
    }
    if (client) break;
  }

  if (!client) {
    console.error(`[mcp] All connection attempts failed for ${options.url}:`, attempts);
    throw lastError ?? new Error("Failed to connect to MCP server");
  }

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
