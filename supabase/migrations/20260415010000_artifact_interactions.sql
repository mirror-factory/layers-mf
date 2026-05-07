-- Artifact interaction tracking: who did what, when, why
CREATE TABLE IF NOT EXISTS artifact_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL,
  user_id UUID NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'created', 'viewed', 'edited', 'shared', 'opened_by_recipient',
    'sandbox_executed', 'ai_read', 'ai_modified', 'forked',
    'restored', 'deleted', 'tagged', 'commented'
  )),
  metadata JSONB DEFAULT '{}',
  chat_context TEXT,
  conversation_id UUID,
  version_number INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_artifact_interactions_artifact ON artifact_interactions(artifact_id);
CREATE INDEX idx_artifact_interactions_user ON artifact_interactions(user_id);
CREATE INDEX idx_artifact_interactions_type ON artifact_interactions(interaction_type);
CREATE INDEX idx_artifact_interactions_created ON artifact_interactions(created_at);

ALTER TABLE artifact_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read artifact interactions" ON artifact_interactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert artifact interactions" ON artifact_interactions
  FOR INSERT TO authenticated WITH CHECK (true);
