-- Platform-wide configuration (super-admin only)
CREATE TABLE IF NOT EXISTS platform_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- No RLS — accessed via admin client only
-- Seed with defaults
INSERT INTO platform_config (key, value) VALUES
  ('model_pricing', '{
    "claude-haiku": { "input_per_mtok": 0.25, "output_per_mtok": 1.25 },
    "claude-sonnet": { "input_per_mtok": 3.00, "output_per_mtok": 15.00 },
    "claude-opus": { "input_per_mtok": 15.00, "output_per_mtok": 75.00 },
    "gpt-4o": { "input_per_mtok": 2.50, "output_per_mtok": 10.00 },
    "gpt-4o-mini": { "input_per_mtok": 0.15, "output_per_mtok": 0.60 },
    "gemini-pro": { "input_per_mtok": 1.25, "output_per_mtok": 5.00 },
    "text-embedding-3-small": { "input_per_mtok": 0.02, "output_per_mtok": 0 }
  }'::jsonb),
  ('credit_config', '{
    "usd_per_credit": 0.10,
    "profit_margin_pct": 40,
    "operations": {
      "chat": { "base_credits": 1, "per_1k_tokens": 0.5 },
      "extraction": { "base_credits": 2, "per_1k_tokens": 0 },
      "embedding": { "base_credits": 0.5, "per_1k_tokens": 0 },
      "inbox_generation": { "base_credits": 1, "per_1k_tokens": 0 },
      "query_expansion": { "base_credits": 0.2, "per_1k_tokens": 0 }
    }
  }'::jsonb),
  ('credit_packages', '[
    { "credits": 100, "price_usd": 9.99, "stripe_price_id": null },
    { "credits": 500, "price_usd": 39.99, "stripe_price_id": null },
    { "credits": 2000, "price_usd": 129.99, "stripe_price_id": null }
  ]'::jsonb)
ON CONFLICT (key) DO NOTHING;
