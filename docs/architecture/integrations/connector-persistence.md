# Connector Persistence Architecture

> Epic 2 from execution-plan.md — Fix Connector Persistence

## Root Cause Analysis (Task 2.1)

### Problem: MCP connections drop after ~1 hour or on server restart

Three root causes identified:

### 1. No Connection Caching (Primary)

Every call to `/api/chat` creates fresh MCP connections via `connectMCPServer()`:

```
chat route → connectMCPServer() → createMCPClient() → fetch tools → use → discard
```

There is no connection pool, no caching, and no reuse between requests. On Vercel's serverless environment, each function invocation starts fresh, so every chat message re-establishes all MCP connections. This adds latency and causes unnecessary load on MCP servers.

### 2. OAuth Tokens Expire Without Refresh

The `mcp_servers` table already stores OAuth tokens (`api_key_encrypted` for access token, `oauth_refresh_token`, `oauth_expires_at`). However, the chat route only reads `api_key_encrypted` and passes it as a bearer token — it never checks `oauth_expires_at` or calls `refreshOAuthToken()`.

After the access token expires (typically 1 hour), all MCP calls silently fail with 401 errors.

### 3. Dead Code: Refresh Functions Exist but Are Never Called

`src/lib/mcp/connect.ts` exports `refreshOAuthToken()` and `isTokenExpired()` — both are fully implemented but have zero call sites in the codebase.

## Solution Architecture

### Connection Manager (Task 2.2)

A module-level singleton `MCPConnectionManager` that:

1. **Caches active connections** in a `Map<serverId, MCPConnection>` with TTL
2. **Lazy-connects on first use** — pulls config from `mcp_servers` table
3. **Reconnects from DB state** — on cold start (serverless), reads persisted state and reconnects
4. **Updates `last_connected_at`** in DB after successful connection
5. **Marks disconnected servers** with `error_message` and `is_active = false` on persistent failures

The connection cache lives in module scope, which survives across requests in the same serverless instance (warm starts) but is lost on cold starts. This is acceptable because reconnection from DB is fast.

### Token Auto-Refresh (Task 2.3)

Before each MCP connection attempt:

1. Check `oauth_expires_at` — if within 5 minutes of expiry, refresh
2. Call the existing `refreshOAuthToken()` with stored credentials
3. On success: update `api_key_encrypted`, `oauth_refresh_token`, `oauth_expires_at` in DB
4. On failure: mark server as disconnected with error message, skip connection
5. Use the fresh access token for the MCP connection

### DB Schema

No new tables needed. The existing `mcp_servers` table already has all required columns:
- `api_key_encrypted` — current access token
- `oauth_refresh_token` — refresh token for auto-renewal
- `oauth_expires_at` — expiry timestamp
- `oauth_token_url` — token endpoint for refresh
- `oauth_client_id` — OAuth client ID
- `oauth_client_secret` — OAuth client secret (optional)
- `last_connected_at` — last successful connection time
- `error_message` — error state for UI display
- `is_active` — connection enabled/disabled

### Key Files

| File | Change |
|------|--------|
| `src/lib/mcp/connect.ts` | Add `MCPConnectionManager` class with caching + token refresh |
| `src/app/api/chat/route.ts` | Replace inline `connectMCPServer` calls with `MCPConnectionManager.getTools()` |
| `docs/architecture/connector-persistence.md` | This document |

### Flow Diagram

```
Chat Request
  → MCPConnectionManager.getToolsForOrg(orgId, adminDb)
    → For each active mcp_server:
      1. Check cache (Map<serverId, {connection, expiresAt}>)
      2. If cached + valid → return tools
      3. If OAuth + token near expiry → refreshOAuthToken()
         → Update DB with new tokens
      4. connectMCPServer() with current access token
      5. Cache connection with TTL
      6. Update last_connected_at in DB
      7. On error → set error_message, mark inactive
    → Return merged tool map
```
