-- Store full OAuth configuration on MCP servers so we don't guess endpoints
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_authorize_url TEXT;
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_token_url TEXT;
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_client_id TEXT;
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_client_secret TEXT;
