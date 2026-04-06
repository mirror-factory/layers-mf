CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'chat_mention', 'share', 'schedule_complete', 'approval_needed', 'library_update'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT, -- URL to navigate to when clicked
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user_recent ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users manage own notifications" ON notifications FOR ALL
  USING (user_id = auth.uid());
