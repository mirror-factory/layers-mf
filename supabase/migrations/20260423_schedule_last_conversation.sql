-- Track the most recent conversation produced by a scheduled run so the UI
-- and tools can jump straight to the latest output.
ALTER TABLE scheduled_actions
  ADD COLUMN IF NOT EXISTS last_conversation_id UUID
  REFERENCES conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_actions_last_conversation
  ON scheduled_actions(last_conversation_id);
