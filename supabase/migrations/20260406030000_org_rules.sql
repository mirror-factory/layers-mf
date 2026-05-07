-- Add scope column to rules table for org-level rules
ALTER TABLE rules ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'org'));
ALTER TABLE rules ADD COLUMN IF NOT EXISTS applies_to_all BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for org-wide rules
CREATE INDEX IF NOT EXISTS idx_rules_org_scope ON rules(org_id, scope) WHERE scope = 'org';
