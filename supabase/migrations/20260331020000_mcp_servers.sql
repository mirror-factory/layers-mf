-- MCP (Model Context Protocol) server connections per organization
CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  api_key_encrypted TEXT,
  transport_type TEXT NOT NULL DEFAULT 'http' CHECK (transport_type IN ('http', 'sse')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  discovered_tools JSONB DEFAULT '[]',
  last_connected_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, url)
);

ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON mcp_servers
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
