-- Per-item sharing (Google Drive-inspired)
CREATE TABLE IF NOT EXISTS content_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'artifact', 'conversation', 'context_item', 'collection'
  )),
  resource_id UUID NOT NULL,
  shared_with_user_id UUID,
  scope TEXT DEFAULT 'user' CHECK (scope IN ('user', 'org')),
  permission TEXT DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
  shared_by UUID NOT NULL,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_shares_resource ON content_shares(resource_type, resource_id);
CREATE INDEX idx_content_shares_user ON content_shares(shared_with_user_id);
CREATE INDEX idx_content_shares_org ON content_shares(org_id);

ALTER TABLE content_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can see shares for them" ON content_shares
  FOR SELECT TO authenticated
  USING (shared_with_user_id = auth.uid() OR shared_by = auth.uid() OR scope = 'org');

CREATE POLICY "authenticated can create shares" ON content_shares
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "sharers can delete shares" ON content_shares
  FOR DELETE TO authenticated USING (shared_by = auth.uid());
