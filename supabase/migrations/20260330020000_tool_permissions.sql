-- Add tool_permissions JSONB column to partner_settings
-- Controls per-service read/write access for the AI agent's tools.
-- Structure: { "linear": { "read": true, "write": true }, "gmail": { "read": true, "write": false }, ... }
ALTER TABLE partner_settings ADD COLUMN IF NOT EXISTS tool_permissions JSONB DEFAULT '{}';
