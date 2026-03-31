-- Store user timezone for schedule display and cron interpretation
ALTER TABLE partner_settings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
