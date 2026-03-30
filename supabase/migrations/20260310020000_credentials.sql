-- Encrypted credentials for third-party service integrations
CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id, provider)
);

ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON credentials
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
