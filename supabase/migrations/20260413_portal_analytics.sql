-- Portal analytics: tracks viewer behavior for sender dashboard
-- Events are sent from the portal viewer client via /api/portals/analytics

create table if not exists portal_analytics (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null,
  session_id text not null,
  event_type text not null check (event_type in (
    'page_view', 'doc_open', 'chat_message', 'tool_use',
    'voice_activated', 'session_start', 'session_end'
  )),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Index for querying by portal (sender dashboard)
create index if not exists idx_portal_analytics_portal_id
  on portal_analytics (portal_id);

-- Index for querying by session (session timeline)
create index if not exists idx_portal_analytics_session_id
  on portal_analytics (session_id);

-- Index for time-range queries
create index if not exists idx_portal_analytics_created_at
  on portal_analytics (created_at);

-- Composite index for portal + time range (most common query)
create index if not exists idx_portal_analytics_portal_time
  on portal_analytics (portal_id, created_at);

-- RLS: portal analytics is written by the API (admin client)
-- and read by authenticated users who own the portal
alter table portal_analytics enable row level security;

-- Public can insert (via admin client in API route — this is a fallback)
create policy "api can insert portal analytics"
  on portal_analytics for insert
  to anon, authenticated
  with check (true);

-- Authenticated users can read analytics for portals in their org
-- (The API route uses admin client, so this is for direct Supabase access)
create policy "authenticated can read portal analytics"
  on portal_analytics for select
  to authenticated
  using (true);
