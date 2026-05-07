-- Public content shares: shareable links for artifacts, context items, and skills
-- Extends the sharing system beyond conversations (which use public_chat_shares)

CREATE TABLE IF NOT EXISTS public_content_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('artifact', 'context_item', 'skill')),
  resource_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  allow_public_view BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_public_content_shares_token ON public_content_shares(share_token) WHERE is_active = TRUE;
CREATE INDEX idx_public_content_shares_resource ON public_content_shares(resource_type, resource_id);

ALTER TABLE public_content_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage their shares" ON public_content_shares
  FOR ALL USING (auth.uid() = shared_by);
