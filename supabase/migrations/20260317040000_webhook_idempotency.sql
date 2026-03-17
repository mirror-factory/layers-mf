-- Webhook idempotency table
-- Prevents duplicate processing on webhook retries for all providers.

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,          -- 'stripe', 'linear', 'discord', 'nango'
  event_id text NOT NULL,          -- provider's event/delivery ID
  event_type text,                 -- e.g., 'checkout.session.completed'
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);

CREATE INDEX idx_webhook_events_lookup ON webhook_events(provider, event_id);
CREATE INDEX idx_webhook_events_cleanup ON webhook_events(created_at);
