-- Context item versions: full version history for change tracking
-- Every sync, user edit, or status change creates a version record
-- Enables diff views, audit trails, and rollback

CREATE TABLE IF NOT EXISTS context_item_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_item_id uuid NOT NULL REFERENCES context_items(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version_number integer NOT NULL,

  -- Snapshot of source data at this version
  title text NOT NULL,
  raw_content text,
  content_hash text,
  source_metadata jsonb,

  -- Change tracking
  change_type text NOT NULL CHECK (change_type IN (
    'created', 'content_updated', 'metadata_updated', 'status_changed', 'deleted'
  )),
  changed_fields text[] DEFAULT '{}',
  changed_by text,  -- e.g., 'sync:linear', 'sync:nango', 'user:<id>', 'webhook:discord'

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  source_updated_at timestamptz,

  UNIQUE(context_item_id, version_number)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_versions_item ON context_item_versions(context_item_id, version_number DESC);
CREATE INDEX idx_versions_created ON context_item_versions(created_at);
CREATE INDEX idx_versions_org ON context_item_versions(org_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE context_item_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions in their org"
  ON context_item_versions
  FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
