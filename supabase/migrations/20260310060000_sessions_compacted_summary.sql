-- Add compacted_summary to sessions for conversation history compaction
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS compacted_summary TEXT;
