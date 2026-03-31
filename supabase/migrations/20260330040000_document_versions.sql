-- Document versions: tracks edit history per document
-- When a user edits a document via PATCH, the previous state is saved here
-- before the update is applied. Enables viewing past versions and restoring.

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_item_id UUID NOT NULL REFERENCES context_items(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  edited_by UUID NOT NULL REFERENCES auth.users(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(context_item_id, version_number)
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- SELECT/UPDATE/DELETE: org members can access versions for their org's items
CREATE POLICY "org_member_read" ON document_versions
  FOR SELECT
  USING (context_item_id IN (
    SELECT id FROM context_items WHERE org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  ));

-- INSERT: org members can create versions for their org's items
CREATE POLICY "org_member_insert" ON document_versions
  FOR INSERT
  WITH CHECK (context_item_id IN (
    SELECT id FROM context_items WHERE org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX document_versions_item ON document_versions(context_item_id, version_number DESC);
