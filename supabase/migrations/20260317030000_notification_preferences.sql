CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  digest_enabled boolean NOT NULL DEFAULT true,
  digest_time text NOT NULL DEFAULT '07:00' CHECK (digest_time ~ '^\d{2}:\d{2}$'),
  email_on_mention boolean NOT NULL DEFAULT true,
  email_on_action_item boolean NOT NULL DEFAULT true,
  email_on_new_context boolean NOT NULL DEFAULT false,
  weekly_summary boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, org_id)
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());
