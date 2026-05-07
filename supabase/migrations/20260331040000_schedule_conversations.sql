-- Track how conversations were initiated and link to scheduled actions
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS initiated_by TEXT NOT NULL DEFAULT 'user' CHECK (initiated_by IN ('user', 'system', 'schedule'));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES scheduled_actions(id);
