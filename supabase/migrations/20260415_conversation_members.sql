-- Multi-user chat conversations
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'participant' CHECK (role IN ('owner', 'participant', 'viewer')),
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID,
  can_see_history_before_join BOOLEAN DEFAULT true,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conversation_members_user ON conversation_members(user_id);

ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read their conversations" ON conversation_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR conversation_id IN (
    SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "authenticated can insert members" ON conversation_members
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "owners can delete members" ON conversation_members
  FOR DELETE TO authenticated
  USING (conversation_id IN (
    SELECT conversation_id FROM conversation_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ));
