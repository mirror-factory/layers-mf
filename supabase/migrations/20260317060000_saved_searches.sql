CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  query text NOT NULL,
  filters jsonb DEFAULT '{}',  -- { source_type, content_type, date_range }
  is_shared boolean NOT NULL DEFAULT false,  -- visible to whole org
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id, created_at DESC);
CREATE INDEX idx_saved_searches_org ON saved_searches(org_id) WHERE is_shared = true;

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved searches"
  ON saved_searches FOR ALL
  USING (user_id = auth.uid() OR (is_shared AND org_id IN (SELECT get_user_org_ids())));
