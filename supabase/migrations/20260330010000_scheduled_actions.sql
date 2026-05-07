-- Scheduled actions: recurring and one-shot tasks managed by Granger
CREATE TABLE scheduled_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  action_type TEXT NOT NULL, -- 'query', 'sync', 'digest', 'custom'
  target_service TEXT, -- 'linear', 'gmail', 'granola', etc.
  payload JSONB NOT NULL DEFAULT '{}',
  schedule TEXT NOT NULL, -- cron expression: '0 7 * * 1-5' or 'once:2026-04-01T09:00:00Z'
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  run_count INT NOT NULL DEFAULT 0,
  max_runs INT, -- null = unlimited, 1 = one-shot
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE scheduled_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON scheduled_actions
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE INDEX scheduled_actions_next_run ON scheduled_actions(next_run_at) WHERE status = 'active';
