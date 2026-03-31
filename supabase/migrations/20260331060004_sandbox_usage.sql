-- Sandbox usage tracking: per-execution cost data for compute, memory, network
CREATE TABLE sandbox_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT,
  sandbox_id TEXT,
  cpu_ms BIGINT DEFAULT 0,
  memory_mb_seconds BIGINT DEFAULT 0,
  network_ingress_bytes BIGINT DEFAULT 0,
  network_egress_bytes BIGINT DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sandbox_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON sandbox_usage
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE INDEX sandbox_usage_org_date ON sandbox_usage(org_id, created_at DESC);
CREATE INDEX sandbox_usage_user ON sandbox_usage(org_id, user_id);
