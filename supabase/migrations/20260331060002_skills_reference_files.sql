-- Add reference_files JSONB column to skills table
-- Stores array of: [{ name: string, content: string, type: "text"|"markdown"|"code" }]
ALTER TABLE skills
  ADD COLUMN IF NOT EXISTS reference_files JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN skills.reference_files IS 'Array of reference file objects: [{name, content, type}] injected into skill context on activation';
