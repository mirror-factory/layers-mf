-- Approval queue for agent-requested actions that need human review
CREATE TABLE approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by_agent TEXT NOT NULL DEFAULT 'granger',
  action_type TEXT NOT NULL,
  target_service TEXT NOT NULL,
  payload JSONB NOT NULL,
  reasoning TEXT,
  conflict_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX approval_queue_org_status ON approval_queue(org_id, status);
CREATE INDEX approval_queue_created ON approval_queue(org_id, created_at DESC);

ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON approval_queue
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
