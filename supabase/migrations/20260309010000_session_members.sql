-- Session members: tracks which users are collaborators on a session
CREATE TABLE session_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

-- RLS: org members can read session members for sessions in their org
ALTER TABLE session_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_read_session_members"
  ON session_members
  FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE s.org_id IN (
        SELECT om.org_id FROM org_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "org_members_can_insert_session_members"
  ON session_members
  FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE s.org_id IN (
        SELECT om.org_id FROM org_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "org_members_can_delete_session_members"
  ON session_members
  FOR DELETE
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      WHERE s.org_id IN (
        SELECT om.org_id FROM org_members om
        WHERE om.user_id = auth.uid()
      )
    )
  );
