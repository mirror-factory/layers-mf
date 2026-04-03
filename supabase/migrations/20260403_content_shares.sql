-- Epic 8: Sharing System — content_shares table
-- Enables fine-grained sharing of context items and artifacts between users

CREATE TABLE IF NOT EXISTS content_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('context_item', 'artifact')),
  shared_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'viewer' CHECK (permission IN ('viewer', 'editor', 'owner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_id, content_type, shared_with)
);

CREATE INDEX idx_shares_shared_with ON content_shares(shared_with);
CREATE INDEX idx_shares_content ON content_shares(content_id, content_type);

ALTER TABLE content_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see shares involving them" ON content_shares
  FOR SELECT USING (auth.uid() = shared_by OR auth.uid() = shared_with);

CREATE POLICY "Users can create shares for their content" ON content_shares
  FOR INSERT WITH CHECK (auth.uid() = shared_by);

CREATE POLICY "Share creators can delete" ON content_shares
  FOR DELETE USING (auth.uid() = shared_by);
