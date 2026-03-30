-- Priority documents table for brand/strategy docs that influence AI context
CREATE TABLE priority_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  weight INT NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE priority_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON priority_documents
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
