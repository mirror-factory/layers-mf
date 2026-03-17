-- Context versioning columns: version tracking + user overlay fields
-- Supports context engineering architecture with freshness tracking
-- and user-owned metadata that sync never overwrites

-- ============================================================
-- CONTEXT ITEMS: Version tracking
-- ============================================================
ALTER TABLE context_items ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1;
ALTER TABLE context_items ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE context_items ADD COLUMN IF NOT EXISTS freshness_at timestamptz DEFAULT now();

-- ============================================================
-- CONTEXT ITEMS: User overlay (NEVER overwritten by sync)
-- ============================================================
ALTER TABLE context_items ADD COLUMN IF NOT EXISTS user_title text;
ALTER TABLE context_items ADD COLUMN IF NOT EXISTS user_notes text;
ALTER TABLE context_items ADD COLUMN IF NOT EXISTS user_tags text[] DEFAULT '{}';
ALTER TABLE context_items ADD COLUMN IF NOT EXISTS trust_weight real NOT NULL DEFAULT 1.0;

-- Indexes for time-based queries
CREATE INDEX IF NOT EXISTS idx_context_items_updated_at ON context_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_context_items_freshness ON context_items(freshness_at);

-- Auto-update updated_at on context_items changes
CREATE TRIGGER context_items_updated_at
  BEFORE UPDATE ON context_items
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- CONTEXT CHUNKS: Embedding metadata
-- ============================================================
ALTER TABLE context_chunks ADD COLUMN IF NOT EXISTS embedding_model text DEFAULT 'text-embedding-3-small';
ALTER TABLE context_chunks ADD COLUMN IF NOT EXISTS embedded_at timestamptz DEFAULT now();
