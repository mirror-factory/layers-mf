-- Session Insights: AI-generated insights about cross-source connections
CREATE TABLE IF NOT EXISTS session_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  insight_type text NOT NULL CHECK (insight_type IN (
    'new_content', 'cross_source_connection', 'contradiction', 'action_item', 'summary_delta'
  )),
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'important', 'critical')),

  -- References
  source_item_ids uuid[] DEFAULT '{}',  -- context_items that triggered this insight
  related_item_ids uuid[] DEFAULT '{}', -- additional related items

  -- Status
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'pinned')),
  dismissed_by uuid REFERENCES auth.users(id),
  dismissed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_session_insights_session ON session_insights(session_id, created_at DESC);
CREATE INDEX idx_session_insights_org ON session_insights(org_id, created_at DESC);

ALTER TABLE session_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org session insights"
  ON session_insights FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Users can manage org session insights"
  ON session_insights FOR ALL
  USING (org_id IN (SELECT get_user_org_ids()));
