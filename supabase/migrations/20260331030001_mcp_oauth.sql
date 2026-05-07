-- Add OAuth support to MCP servers
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS auth_type TEXT NOT NULL DEFAULT 'bearer' CHECK (auth_type IN ('bearer', 'oauth', 'none'));
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT;
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_expires_at TIMESTAMPTZ;
