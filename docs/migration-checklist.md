# Supabase Migration Checklist

Run these migrations in order on the production Supabase instance.

## Required Migrations (v0.9.0)

1. `supabase/migrations/20260413_portal_analytics.sql` — Portal viewer analytics
2. `supabase/migrations/20260415_artifact_interactions.sql` — Artifact interaction tracking
3. `supabase/migrations/20260415_conversation_members.sql` — Multi-user conversations
4. `supabase/migrations/20260415_content_shares.sql` — Content sharing with permissions
5. `supabase/migrations/20260415_schedule_tool_tier.sql` — Schedule tool tier column

## How to run

### Option A: Supabase Dashboard
1. Go to SQL Editor in your Supabase dashboard
2. Paste each migration file's contents
3. Run in order

### Option B: Supabase CLI
```bash
supabase db push
```

### Option C: Direct psql
```bash
psql $DATABASE_URL -f supabase/migrations/20260413_portal_analytics.sql
# ... repeat for each file
```

## Verification
After running all migrations, verify tables exist:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('portal_analytics', 'artifact_interactions', 'conversation_members', 'content_shares');
```

And verify the schedule column:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'scheduled_actions' AND column_name = 'tool_tier';
```
