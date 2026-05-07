-- ============================================================
-- LIBRARY LAYER
-- Durable primitives for Layers as the company context box.
--
-- Existing foundations remain:
--   context_items     -> Library Items
--   collections       -> Stacks
--   inbox_items       -> Library Inbox
--   context_chunks    -> searchable chunks
-- ============================================================

-- ------------------------------------------------------------
-- 1. Context item domain fields
-- ------------------------------------------------------------
alter table context_items add column if not exists library_item_type text;
alter table context_items add column if not exists library_scope text not null default 'org';
alter table context_items add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table context_items add column if not exists summary text;
alter table context_items add column if not exists relationship_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_context_items_library_type
  on context_items(org_id, library_item_type);

create index if not exists idx_context_items_scope
  on context_items(org_id, library_scope);

-- ------------------------------------------------------------
-- 2. Provenance / source records
-- ------------------------------------------------------------
create table if not exists library_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  context_item_id uuid references context_items(id) on delete cascade,
  source_kind text not null,
  provider text,
  mcp_server_id uuid references mcp_servers(id) on delete set null,
  external_id text,
  external_url text,
  import_mode text not null default 'manual'
    check (import_mode in ('manual', 'live_lookup', 'save_selected', 'sync_rule', 'upload', 'chat_save', 'artifact', 'generated')),
  imported_by uuid references auth.users(id) on delete set null,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  license text,
  prompt text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_library_sources_org_item
  on library_sources(org_id, context_item_id);

create index if not exists idx_library_sources_mcp
  on library_sources(org_id, mcp_server_id);

create unique index if not exists idx_library_sources_external_unique
  on library_sources(org_id, source_kind, provider, external_id)
  where external_id is not null;

alter table library_sources enable row level security;

drop policy if exists "library_sources_org_select" on library_sources;
create policy "library_sources_org_select" on library_sources for select using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_sources_org_insert" on library_sources;
create policy "library_sources_org_insert" on library_sources for insert with check (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_sources_org_update" on library_sources;
create policy "library_sources_org_update" on library_sources for update using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_sources_org_delete" on library_sources;
create policy "library_sources_org_delete" on library_sources for delete using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

-- ------------------------------------------------------------
-- 3. Assets and item attachments
-- ------------------------------------------------------------
create table if not exists library_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  kind text not null default 'file'
    check (kind in ('image', 'file', 'generated_image', 'screenshot', 'diagram', 'whiteboard', 'artifact_preview', 'external_media')),
  title text,
  storage_bucket text,
  storage_path text,
  original_url text,
  thumbnail_path text,
  mime_type text,
  size_bytes bigint,
  width int,
  height int,
  sha256 text,
  alt_text text,
  caption text,
  ocr_text text,
  prompt text,
  model text,
  license text,
  source_id uuid references library_sources(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_library_assets_org_kind
  on library_assets(org_id, kind);

create index if not exists idx_library_assets_source
  on library_assets(source_id);

create index if not exists idx_library_assets_search
  on library_assets using gin(
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(caption, '') || ' ' ||
      coalesce(ocr_text, '') || ' ' ||
      coalesce(alt_text, '')
    )
  );

alter table library_assets enable row level security;

drop policy if exists "library_assets_org_select" on library_assets;
create policy "library_assets_org_select" on library_assets for select using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_assets_org_insert" on library_assets;
create policy "library_assets_org_insert" on library_assets for insert with check (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_assets_org_update" on library_assets;
create policy "library_assets_org_update" on library_assets for update using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_assets_org_delete" on library_assets;
create policy "library_assets_org_delete" on library_assets for delete using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

create table if not exists library_item_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  context_item_id uuid not null references context_items(id) on delete cascade,
  asset_id uuid not null references library_assets(id) on delete cascade,
  role text not null default 'attachment',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(context_item_id, asset_id, role)
);

create index if not exists idx_library_item_assets_item
  on library_item_assets(context_item_id, sort_order);

create index if not exists idx_library_item_assets_asset
  on library_item_assets(asset_id);

alter table library_item_assets enable row level security;

drop policy if exists "library_item_assets_org_select" on library_item_assets;
create policy "library_item_assets_org_select" on library_item_assets for select using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_item_assets_org_insert" on library_item_assets;
create policy "library_item_assets_org_insert" on library_item_assets for insert with check (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_item_assets_org_delete" on library_item_assets;
create policy "library_item_assets_org_delete" on library_item_assets for delete using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

-- ------------------------------------------------------------
-- 4. Item graph relationships
-- ------------------------------------------------------------
create table if not exists library_item_relationships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  from_context_item_id uuid not null references context_items(id) on delete cascade,
  to_context_item_id uuid not null references context_items(id) on delete cascade,
  relationship_type text not null,
  confidence float not null default 1.0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(from_context_item_id, to_context_item_id, relationship_type)
);

create index if not exists idx_library_relationships_from
  on library_item_relationships(org_id, from_context_item_id);

create index if not exists idx_library_relationships_to
  on library_item_relationships(org_id, to_context_item_id);

alter table library_item_relationships enable row level security;

drop policy if exists "library_item_relationships_org_select" on library_item_relationships;
create policy "library_item_relationships_org_select" on library_item_relationships for select using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_item_relationships_org_insert" on library_item_relationships;
create policy "library_item_relationships_org_insert" on library_item_relationships for insert with check (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_item_relationships_org_update" on library_item_relationships;
create policy "library_item_relationships_org_update" on library_item_relationships for update using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_item_relationships_org_delete" on library_item_relationships;
create policy "library_item_relationships_org_delete" on library_item_relationships for delete using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

-- ------------------------------------------------------------
-- 5. Context packs for handoffs
-- ------------------------------------------------------------
create table if not exists context_packs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  purpose text,
  created_by uuid references auth.users(id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private', 'org', 'external')),
  retrieval_query text,
  instructions text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_context_packs_org_created
  on context_packs(org_id, created_at desc);

alter table context_packs enable row level security;

drop policy if exists "context_packs_org_select" on context_packs;
create policy "context_packs_org_select" on context_packs for select using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "context_packs_org_insert" on context_packs;
create policy "context_packs_org_insert" on context_packs for insert with check (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "context_packs_org_update" on context_packs;
create policy "context_packs_org_update" on context_packs for update using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "context_packs_org_delete" on context_packs;
create policy "context_packs_org_delete" on context_packs for delete using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

create table if not exists context_pack_items (
  id uuid primary key default gen_random_uuid(),
  context_pack_id uuid not null references context_packs(id) on delete cascade,
  context_item_id uuid not null references context_items(id) on delete cascade,
  include_full_content boolean not null default false,
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(context_pack_id, context_item_id)
);

create index if not exists idx_context_pack_items_pack
  on context_pack_items(context_pack_id, sort_order);

alter table context_pack_items enable row level security;

drop policy if exists "context_pack_items_org_select" on context_pack_items;
create policy "context_pack_items_org_select" on context_pack_items for select using (
  context_pack_id in (
    select id from context_packs where org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  )
);

drop policy if exists "context_pack_items_org_insert" on context_pack_items;
create policy "context_pack_items_org_insert" on context_pack_items for insert with check (
  context_pack_id in (
    select id from context_packs where org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  )
);

drop policy if exists "context_pack_items_org_delete" on context_pack_items;
create policy "context_pack_items_org_delete" on context_pack_items for delete using (
  context_pack_id in (
    select id from context_packs where org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  )
);

create trigger context_packs_updated_at
  before update on context_packs
  for each row execute function handle_updated_at();

-- ------------------------------------------------------------
-- 6. Dewey profile/config
-- ------------------------------------------------------------
create table if not exists dewey_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null default 'Dewey',
  voice text not null default 'clear, curious, concise',
  tone text not null default 'pragmatic librarian',
  allowed_tools text[] not null default array[
    'search_library',
    'get_library_item',
    'add_library_item',
    'list_stacks',
    'create_stack',
    'save_asset',
    'create_context_pack',
    'propose_action'
  ],
  approval_policy text not null default 'risky_writes_require_approval',
  default_retrieval_scope jsonb not null default '{"library_scope":"org","include_archived":false}'::jsonb,
  memory_policy jsonb not null default '{"save_useful_chat":true,"ask_before_saving_sensitive":true}'::jsonb,
  save_behavior text not null default 'suggest_then_save'
    check (save_behavior in ('never', 'suggest_then_save', 'auto_low_risk')),
  instructions text,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, name)
);

create unique index if not exists idx_dewey_profiles_default
  on dewey_profiles(org_id)
  where is_default = true;

alter table dewey_profiles enable row level security;

drop policy if exists "dewey_profiles_org_select" on dewey_profiles;
create policy "dewey_profiles_org_select" on dewey_profiles for select using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "dewey_profiles_org_insert" on dewey_profiles;
create policy "dewey_profiles_org_insert" on dewey_profiles for insert with check (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "dewey_profiles_org_update" on dewey_profiles;
create policy "dewey_profiles_org_update" on dewey_profiles for update using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

create trigger dewey_profiles_updated_at
  before update on dewey_profiles
  for each row execute function handle_updated_at();

-- ------------------------------------------------------------
-- 7. MCP ingestion hardening
-- ------------------------------------------------------------
alter table mcp_servers add column if not exists oauth_scopes text[] not null default '{}';
alter table mcp_servers add column if not exists oauth_status text not null default 'not_required'
  check (oauth_status in ('not_required', 'needs_auth', 'active', 'expired', 'revoked', 'error'));
alter table mcp_servers add column if not exists oauth_token_metadata jsonb not null default '{}'::jsonb;
alter table mcp_servers add column if not exists health_status text not null default 'unknown'
  check (health_status in ('unknown', 'healthy', 'degraded', 'down', 'reauth_required'));
alter table mcp_servers add column if not exists health_checked_at timestamptz;
alter table mcp_servers add column if not exists reconnect_after timestamptz;
alter table mcp_servers add column if not exists tool_snapshot jsonb not null default '[]'::jsonb;
alter table mcp_servers add column if not exists failure_count int not null default 0;

create table if not exists mcp_import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  mcp_server_id uuid references mcp_servers(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('live_lookup', 'save_selected', 'sync_rule')),
  query text,
  selected_count int not null default 0,
  saved_count int not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_mcp_import_batches_org_created
  on mcp_import_batches(org_id, created_at desc);

alter table mcp_import_batches enable row level security;

drop policy if exists "mcp_import_batches_org_select" on mcp_import_batches;
create policy "mcp_import_batches_org_select" on mcp_import_batches for select using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "mcp_import_batches_org_insert" on mcp_import_batches;
create policy "mcp_import_batches_org_insert" on mcp_import_batches for insert with check (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "mcp_import_batches_org_update" on mcp_import_batches;
create policy "mcp_import_batches_org_update" on mcp_import_batches for update using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

create table if not exists mcp_sync_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  mcp_server_id uuid not null references mcp_servers(id) on delete cascade,
  name text not null,
  tool_name text,
  query text,
  selector jsonb not null default '{}'::jsonb,
  destination_collection_id uuid references collections(id) on delete set null,
  item_type text,
  cadence text,
  is_active boolean not null default true,
  approval_required boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  last_run_at timestamptz,
  next_run_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, mcp_server_id, name)
);

create index if not exists idx_mcp_sync_rules_org_active
  on mcp_sync_rules(org_id, is_active, next_run_at);

alter table mcp_sync_rules enable row level security;

drop policy if exists "mcp_sync_rules_org_select" on mcp_sync_rules;
create policy "mcp_sync_rules_org_select" on mcp_sync_rules for select using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "mcp_sync_rules_org_insert" on mcp_sync_rules;
create policy "mcp_sync_rules_org_insert" on mcp_sync_rules for insert with check (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "mcp_sync_rules_org_update" on mcp_sync_rules;
create policy "mcp_sync_rules_org_update" on mcp_sync_rules for update using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "mcp_sync_rules_org_delete" on mcp_sync_rules;
create policy "mcp_sync_rules_org_delete" on mcp_sync_rules for delete using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

create trigger mcp_sync_rules_updated_at
  before update on mcp_sync_rules
  for each row execute function handle_updated_at();

-- ------------------------------------------------------------
-- 8. External call audit for Layers-as-MCP-server and actions
-- ------------------------------------------------------------
create table if not exists library_external_calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'system_agent'
    check (actor_type in ('human', 'system_agent', 'external_client')),
  direction text not null check (direction in ('inbound', 'outbound')),
  tool_name text,
  target_service text,
  request_summary text,
  status text not null default 'ok' check (status in ('ok', 'approval_required', 'denied', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_library_external_calls_org_created
  on library_external_calls(org_id, created_at desc);

alter table library_external_calls enable row level security;

drop policy if exists "library_external_calls_org_select" on library_external_calls;
create policy "library_external_calls_org_select" on library_external_calls for select using (
  org_id in (select org_id from org_members where user_id = auth.uid())
);

drop policy if exists "library_external_calls_org_insert" on library_external_calls;
create policy "library_external_calls_org_insert" on library_external_calls for insert with check (
  org_id in (select org_id from org_members where user_id = auth.uid())
);
