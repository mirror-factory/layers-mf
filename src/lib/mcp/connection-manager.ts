/**
 * MCP Connection Manager — singleton cache for MCP server connections.
 *
 * Reuses connections across chat requests within the same process.
 * Handles token refresh for OAuth-authenticated servers.
 */

import type { MCPClient } from "@ai-sdk/mcp";
import {
  connectMCPServer,
  refreshOAuthToken,
  isTokenExpired,
  type MCPServerAuth,
  type AuthType,
} from "./connect";

export interface CachedConnection {
  client: MCPClient;
  tools: Record<string, unknown>;
  connectedAt: number;
  serverId: string;
}

/** Max age before a connection is considered stale (10 minutes) */
const MAX_CONNECTION_AGE_MS = 10 * 60 * 1000;

/** Module-level singleton cache */
const connectionCache = new Map<string, CachedConnection>();

function isStale(conn: CachedConnection): boolean {
  return Date.now() - conn.connectedAt > MAX_CONNECTION_AGE_MS;
}

/**
 * Ensure OAuth tokens are still valid for a server. If expired, refresh
 * and return the new tokens so the caller can persist them.
 */
export async function ensureAuth(
  auth: MCPServerAuth,
): Promise<{
  apiKey: string | undefined;
  refreshed: boolean;
  newTokens?: { accessToken: string; refreshToken?: string; expiresAt?: string };
}> {
  if (auth.authType !== "oauth") {
    return { apiKey: auth.apiKey, refreshed: false };
  }

  if (!isTokenExpired(auth.oauthExpiresAt)) {
    return { apiKey: auth.apiKey, refreshed: false };
  }

  console.log("[mcp-manager] OAuth token expired, refreshing...");
  const newTokens = await refreshOAuthToken(auth);

  if (!newTokens) {
    console.warn("[mcp-manager] Token refresh failed, using existing token");
    return { apiKey: auth.apiKey, refreshed: false };
  }

  console.log("[mcp-manager] Token refreshed successfully");
  return {
    apiKey: newTokens.accessToken,
    refreshed: true,
    newTokens,
  };
}

/**
 * Get a cached connection or create a new one.
 * Returns the cached MCP connection with its tools.
 */
export async function getConnection(options: {
  serverId: string;
  url: string;
  apiKey?: string;
  transportType?: "http" | "sse";
  authType?: AuthType;
}): Promise<CachedConnection> {
  const existing = connectionCache.get(options.serverId);

  if (existing && !isStale(existing)) {
    return existing;
  }

  // Close stale connection before creating new one
  if (existing) {
    try {
      await existing.client.close();
    } catch {
      // Ignore close errors on stale connections
    }
    connectionCache.delete(options.serverId);
  }

  const connection = await connectMCPServer({
    url: options.url,
    apiKey: options.apiKey,
    transportType: options.transportType,
    authType: options.authType,
  });

  const cached: CachedConnection = {
    client: connection.client,
    tools: connection.tools,
    connectedAt: Date.now(),
    serverId: options.serverId,
  };

  connectionCache.set(options.serverId, cached);
  return cached;
}

/**
 * Disconnect and remove all cached connections.
 */
export async function disconnectAll(): Promise<void> {
  const closePromises = Array.from(connectionCache.values()).map(
    async (conn) => {
      try {
        await conn.client.close();
      } catch {
        // Ignore close errors during cleanup
      }
    },
  );

  await Promise.allSettled(closePromises);
  connectionCache.clear();
  console.log("[mcp-manager] All connections disconnected");
}

/**
 * Remove a single connection from the cache (e.g. on error).
 */
export async function removeConnection(serverId: string): Promise<void> {
  const conn = connectionCache.get(serverId);
  if (conn) {
    try {
      await conn.client.close();
    } catch {
      // Ignore
    }
    connectionCache.delete(serverId);
  }
}

/** Get the current number of cached connections (for diagnostics). */
export function connectionCount(): number {
  return connectionCache.size;
}
