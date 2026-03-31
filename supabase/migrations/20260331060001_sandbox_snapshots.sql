-- Sandbox snapshots: persist Vercel Sandbox VM state for instant restore
CREATE TABLE sandbox_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  snapshot_id TEXT NOT NULL, -- Vercel sandbox snapshot ID
  metadata JSONB DEFAULT '{}', -- file list, packages, runtime info
  cpu_usage_ms BIGINT DEFAULT 0,
  network_ingress_bytes BIGINT DEFAULT 0,
  network_egress_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sandbox_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON sandbox_snapshots
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE INDEX sandbox_snapshots_org_latest ON sandbox_snapshots(org_id, created_at DESC);
