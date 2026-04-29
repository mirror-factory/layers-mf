-- Per-item sharing (Google Drive-inspired)
-- Extends the earlier content_shares table with resource-level shares while
-- preserving the legacy context/artifact content-share API.

CREATE TABLE IF NOT EXISTS content_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID,
  content_type TEXT,
  shared_by UUID NOT NULL,
  shared_with UUID,
  permission TEXT DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_shares
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id UUID,
  ADD COLUMN IF NOT EXISTS shared_with_user_id UUID,
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS org_id UUID;

ALTER TABLE content_shares
  ALTER COLUMN content_id DROP NOT NULL,
  ALTER COLUMN content_type DROP NOT NULL,
  ALTER COLUMN shared_with DROP NOT NULL,
  ALTER COLUMN permission DROP NOT NULL;

ALTER TABLE content_shares DROP CONSTRAINT IF EXISTS content_shares_content_type_check;
ALTER TABLE content_shares DROP CONSTRAINT IF EXISTS content_shares_permission_check;
ALTER TABLE content_shares DROP CONSTRAINT IF EXISTS content_shares_resource_type_check;
ALTER TABLE content_shares DROP CONSTRAINT IF EXISTS content_shares_scope_check;

ALTER TABLE content_shares
  ADD CONSTRAINT content_shares_content_type_check
  CHECK (content_type IS NULL OR content_type IN ('context_item', 'artifact'));

ALTER TABLE content_shares
  ADD CONSTRAINT content_shares_resource_type_check
  CHECK (resource_type IS NULL OR resource_type IN ('artifact', 'conversation', 'context_item', 'collection'));

ALTER TABLE content_shares
  ADD CONSTRAINT content_shares_scope_check
  CHECK (scope IS NULL OR scope IN ('user', 'org'));

ALTER TABLE content_shares
  ADD CONSTRAINT content_shares_permission_check
  CHECK (permission IS NULL OR permission IN ('viewer', 'editor', 'owner', 'view', 'edit', 'admin'));

CREATE INDEX IF NOT EXISTS idx_content_shares_resource ON content_shares(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_content_shares_user ON content_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_content_shares_org ON content_shares(org_id);

ALTER TABLE content_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can see resource shares for them" ON content_shares
  FOR SELECT TO authenticated
  USING (shared_with_user_id = auth.uid() OR shared_by = auth.uid() OR scope = 'org');

CREATE POLICY "authenticated can create resource shares" ON content_shares
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "sharers can delete resource shares" ON content_shares
  FOR DELETE TO authenticated USING (shared_by = auth.uid());
