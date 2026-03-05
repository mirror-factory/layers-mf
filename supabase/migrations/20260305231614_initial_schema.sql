-- Enable pgvector extension
create extension if not exists vector;

-- Enable full-text search
create extension if not exists pg_trgm;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  stripe_customer_id text,
  credit_balance integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ORG MEMBERS
-- ============================================================
create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  unique(org_id, user_id)
);

-- ============================================================
-- INTEGRATIONS
-- ============================================================
create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  provider text not null,
  nango_connection_id text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'error')),
  last_sync_at timestamptz,
  sync_config jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(org_id, provider)
);

-- ============================================================
-- CONTEXT ITEMS
-- ============================================================
create table context_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  source_type text not null check (source_type in ('granola', 'linear', 'discord', 'gdrive', 'upload')),
  source_id text,
  nango_connection_id text,

  -- Multi-level descriptions
  title text not null,
  description_short text,
  description_long text,
  raw_content text,
  content_type text not null check (content_type in ('meeting_transcript', 'document', 'message', 'issue', 'file')),

  -- Structured extraction output
  entities jsonb,

  -- Vector embedding (text-embedding-3-small = 1536 dims)
  embedding vector(1536),

  -- Processing status
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'error')),

  -- Source metadata
  source_metadata jsonb,
  source_created_at timestamptz,

  -- Timestamps
  ingested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index on context_items(org_id, status);
create index on context_items(org_id, source_type);
create index on context_items(org_id, content_type);
create index on context_items using hnsw (embedding vector_cosine_ops);

-- Full-text search index
create index on context_items using gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description_long, '') || ' ' || coalesce(raw_content, '')));

-- ============================================================
-- SESSIONS
-- ============================================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  goal text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  agent_config jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_agent_run timestamptz
);

create index on sessions(org_id, status);

-- ============================================================
-- SESSION CONTEXT LINKS
-- ============================================================
create table session_context_links (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  context_item_id uuid not null references context_items(id) on delete cascade,
  relevance_score float,
  added_by text not null default 'auto',
  unique(session_id, context_item_id)
);

-- ============================================================
-- INBOX ITEMS
-- ============================================================
create table inbox_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  context_item_id uuid references context_items(id) on delete set null,

  type text not null check (type in ('action_item', 'decision', 'mention', 'new_context', 'overdue')),
  title text not null,
  body text,
  priority text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  status text not null default 'unread' check (status in ('unread', 'read', 'acted', 'dismissed')),

  source_type text,
  source_url text,

  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index on inbox_items(org_id, user_id, status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table integrations enable row level security;
alter table context_items enable row level security;
alter table sessions enable row level security;
alter table session_context_links enable row level security;
alter table inbox_items enable row level security;

-- Helper function: get org IDs for current user
create or replace function get_user_org_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select org_id from org_members where user_id = auth.uid()
$$;

-- Organizations: members can see their orgs
create policy "Users can view their organizations"
  on organizations for select
  using (id in (select get_user_org_ids()));

-- Org members: members can see their org's members
create policy "Users can view org members"
  on org_members for select
  using (org_id in (select get_user_org_ids()));

-- Integrations: org-scoped
create policy "Users can view org integrations"
  on integrations for select
  using (org_id in (select get_user_org_ids()));

create policy "Users can manage org integrations"
  on integrations for all
  using (org_id in (select get_user_org_ids()));

-- Context items: org-scoped
create policy "Users can view org context items"
  on context_items for select
  using (org_id in (select get_user_org_ids()));

create policy "Users can manage org context items"
  on context_items for all
  using (org_id in (select get_user_org_ids()));

-- Sessions: org-scoped
create policy "Users can view org sessions"
  on sessions for select
  using (org_id in (select get_user_org_ids()));

create policy "Users can manage org sessions"
  on sessions for all
  using (org_id in (select get_user_org_ids()));

-- Session context links: via session org
create policy "Users can view session context links"
  on session_context_links for select
  using (session_id in (select id from sessions where org_id in (select get_user_org_ids())));

create policy "Users can manage session context links"
  on session_context_links for all
  using (session_id in (select id from sessions where org_id in (select get_user_org_ids())));

-- Inbox items: user-scoped
create policy "Users can view their inbox items"
  on inbox_items for select
  using (user_id = auth.uid());

create policy "Users can manage their inbox items"
  on inbox_items for all
  using (user_id = auth.uid());

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sessions_updated_at
  before update on sessions
  for each row execute function handle_updated_at();
