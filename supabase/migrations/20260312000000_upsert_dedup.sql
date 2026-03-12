-- Add content hash for change detection (skip reprocessing if unchanged)
ALTER TABLE context_items
  ADD COLUMN IF NOT EXISTS content_hash text;

-- Unique constraint for upsert/dedup on source items
-- source_id can be null for uploads, so use partial index
CREATE UNIQUE INDEX IF NOT EXISTS uq_context_items_source
  ON context_items (org_id, source_type, source_id)
  WHERE source_id IS NOT NULL;
