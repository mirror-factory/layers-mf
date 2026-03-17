CREATE TABLE IF NOT EXISTS usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  operation text NOT NULL,  -- 'chat', 'extraction', 'embedding', 'query_expansion', 'inbox_generation'
  model text NOT NULL,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_tokens integer GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  cost_usd numeric(10,6) DEFAULT 0,
  credits_used numeric(6,2) DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_logs_org ON usage_logs(org_id, created_at DESC);
CREATE INDEX idx_usage_logs_operation ON usage_logs(org_id, operation);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view org usage" ON usage_logs FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
