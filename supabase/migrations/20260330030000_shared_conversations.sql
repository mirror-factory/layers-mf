-- Shared conversations: allows users to share chat conversations with team members
CREATE TABLE IF NOT EXISTS shared_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  shared_with UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, shared_with)
);

ALTER TABLE shared_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_see_shared" ON shared_conversations
  FOR ALL
  USING (shared_by = auth.uid() OR shared_with = auth.uid());

CREATE POLICY "users_can_share" ON shared_conversations
  FOR INSERT
  WITH CHECK (shared_by = auth.uid());
