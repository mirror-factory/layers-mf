-- Per-user partner settings (AI gateway keys, notification prefs, etc.)
CREATE TABLE partner_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_gateway_key_encrypted TEXT,
  default_model TEXT,
  discord_user_id TEXT,
  notification_preferences JSONB DEFAULT '{}',
  approval_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partner_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_settings" ON partner_settings
  USING (user_id = auth.uid());
