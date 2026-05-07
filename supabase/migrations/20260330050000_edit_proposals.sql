-- Edit proposals: majority-approval system for shared document edits
CREATE TABLE IF NOT EXISTS edit_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_item_id UUID NOT NULL REFERENCES context_items(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES auth.users(id),
  proposed_title TEXT,
  proposed_content TEXT NOT NULL,
  change_summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approvals JSONB DEFAULT '[]', -- array of {user_id, approved: bool, timestamp}
  required_approvals INT NOT NULL DEFAULT 2, -- majority of 3
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX edit_proposals_org_status ON edit_proposals(org_id, status);
CREATE INDEX edit_proposals_context_item ON edit_proposals(context_item_id);
CREATE INDEX edit_proposals_created ON edit_proposals(org_id, created_at DESC);

ALTER TABLE edit_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON edit_proposals
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
