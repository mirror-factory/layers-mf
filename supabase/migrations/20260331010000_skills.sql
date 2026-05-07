CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  author TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  icon TEXT DEFAULT '⚡',
  system_prompt TEXT,
  tools JSONB DEFAULT '[]',
  config JSONB DEFAULT '{}',
  slash_command TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  install_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug)
);

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON skills
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
