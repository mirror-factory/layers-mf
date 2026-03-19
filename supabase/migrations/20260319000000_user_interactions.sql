-- User interaction tracking for Ditto personalization
CREATE TABLE IF NOT EXISTS user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  interaction_type text NOT NULL CHECK (interaction_type IN (
    'search', 'click', 'dismiss', 'star', 'chat_query', 'dwell', 'export'
  )),

  -- What was interacted with
  resource_type text, -- 'context_item', 'search_result', 'inbox_item', 'session'
  resource_id uuid,

  -- Context
  query text,                -- search query (for search/chat_query types)
  source_type text,          -- which source the item came from
  content_type text,         -- document, issue, message, etc.
  metadata jsonb DEFAULT '{}', -- additional context (dwell time, position in results, etc.)

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_interactions_user ON user_interactions(user_id, created_at DESC);
CREATE INDEX idx_user_interactions_org ON user_interactions(org_id, created_at DESC);
CREATE INDEX idx_user_interactions_type ON user_interactions(user_id, interaction_type);

ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own interactions"
  ON user_interactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own interactions"
  ON user_interactions FOR INSERT
  WITH CHECK (user_id = auth.uid());
