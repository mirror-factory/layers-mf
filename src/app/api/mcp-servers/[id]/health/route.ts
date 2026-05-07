import { NextResponse } from "next/server";
import { requireUserAndOrg, isAuthFailure } from "@/lib/api/auth";
import { testMCPConnection } from "@/lib/mcp/connect";
import { ensureAuth } from "@/lib/mcp/connection-manager";
import {
  classifyMcpHealth,
  nextMcpReconnectAfter,
  snapshotMcpTools,
} from "@/lib/mcp/health";

type RouteContext = { params: Promise<{ id: string }> };

type McpServerRow = {
  id: string;
  org_id: string;
  name: string;
  url: string;
  api_key_encrypted: string | null;
  transport_type: "http" | "sse";
  auth_type: "bearer" | "oauth" | "none" | null;
  oauth_refresh_token: string | null;
  oauth_expires_at: string | null;
  oauth_token_url: string | null;
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
  failure_count: number | null;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireUserAndOrg();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await context.params;
  const { data: server, error } = await auth.supabase
    .from("mcp_servers")
    .select("id, org_id, name, url, api_key_encrypted, transport_type, auth_type, oauth_refresh_token, oauth_expires_at, oauth_token_url, oauth_client_id, oauth_client_secret, failure_count")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .single();

  if (error || !server) {
    return NextResponse.json({ error: "MCP server not found" }, { status: 404 });
  }

  const row = server as McpServerRow;
  const checkedAt = new Date().toISOString();
  const authResult = await ensureAuth({
    authType: row.auth_type ?? "none",
    apiKey: row.api_key_encrypted ?? undefined,
    oauthRefreshToken: row.oauth_refresh_token ?? undefined,
    oauthExpiresAt: row.oauth_expires_at ?? undefined,
    tokenUrl: row.oauth_token_url ?? undefined,
    clientId: row.oauth_client_id ?? undefined,
    clientSecret: row.oauth_client_secret ?? undefined,
  });

  if (authResult.refreshed && authResult.newTokens) {
    await auth.supabase
      .from("mcp_servers")
      .update({
        api_key_encrypted: authResult.newTokens.accessToken,
        oauth_refresh_token: authResult.newTokens.refreshToken,
        oauth_expires_at: authResult.newTokens.expiresAt,
        oauth_status: "connected",
        oauth_token_metadata: {
          refreshedAt: checkedAt,
        },
      })
      .eq("id", row.id)
      .eq("org_id", auth.orgId);
  }

  const result = await testMCPConnection(
    row.url,
    authResult.apiKey,
    row.transport_type,
  );
  const status = classifyMcpHealth({
    success: result.success,
    requiresOAuth: result.requiresOAuth,
    toolCount: result.toolCount,
  });

  const nextFailureCount = result.success ? 0 : (row.failure_count ?? 0) + 1;
  const toolSnapshot = snapshotMcpTools(result.toolNames, checkedAt);
  const reconnectAfter = result.success ? null : nextMcpReconnectAfter(nextFailureCount);

  const updates: Record<string, unknown> = {
    health_status: status,
    health_checked_at: checkedAt,
    failure_count: nextFailureCount,
    reconnect_after: reconnectAfter,
    error_message: result.success ? null : result.error ?? "Connection failed",
    is_active: result.success,
  };

  if (result.success) {
    updates.last_connected_at = checkedAt;
    updates.discovered_tools = toolSnapshot;
    updates.tool_snapshot = toolSnapshot;
    if (row.auth_type === "oauth") updates.oauth_status = "connected";
  }

  if (status === "reauth_required") {
    updates.oauth_status = "needs_auth";
  }

  await auth.supabase
    .from("mcp_servers")
    .update(updates)
    .eq("id", row.id)
    .eq("org_id", auth.orgId);

  return NextResponse.json({
    id: row.id,
    name: row.name,
    success: result.success,
    healthStatus: status,
    checkedAt,
    reconnectAfter,
    failureCount: nextFailureCount,
    toolSnapshot,
    error: result.error,
    requiresOAuth: result.requiresOAuth,
  });
}
