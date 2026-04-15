-- Add tool_tier to scheduled_actions for configurable tool access
ALTER TABLE scheduled_actions ADD COLUMN IF NOT EXISTS tool_tier TEXT DEFAULT 'minimal'
  CHECK (tool_tier IN ('minimal', 'standard', 'full'));
