-- Add initiated_by column to conversations
-- Tracks how a conversation was created: 'user' (default), 'schedule', 'system'
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS initiated_by TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS conversations_initiated
  ON conversations(org_id, initiated_by, created_at DESC)
  WHERE initiated_by != 'user';
