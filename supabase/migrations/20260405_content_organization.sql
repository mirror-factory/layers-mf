-- ============================================================
-- CONTENT ORGANIZATION SYSTEM
-- Collections, tags, pins, and context_items enhancements
-- ============================================================

-- ============================================================
-- 1. COLLECTIONS — user-created folders with nesting
-- ============================================================
create table collections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  parent_id uuid references collections(id),
  name text not null,
  description text,
  icon text,
  color text,
  sort_order int default 0,
  is_smart boolean default false,
  smart_filter jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_collections_org_parent on collections(org_id, parent_id);
create index idx_collections_org_smart on collections(org_id, is_smart) where is_smart = true;

-- ============================================================
-- 2. COLLECTION_ITEMS — many-to-many linking items to collections
-- ============================================================
create table collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  context_item_id uuid not null references context_items(id) on delete cascade,
  sort_order int default 0,
  added_by uuid references auth.users(id),
  added_at timestamptz default now(),
  unique(collection_id, context_item_id)
);

create index idx_collection_items_context on collection_items(context_item_id);
create index idx_collection_items_collection on collection_items(collection_id);

-- ============================================================
-- 3. TAGS — org-scoped tag definitions
-- ============================================================
create table tags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text,
  tag_type text default 'user' check (tag_type in ('user', 'ai', 'system')),
  usage_count int default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(org_id, name)
);

create index idx_tags_org_name on tags(org_id, name);
create index idx_tags_org_usage on tags(org_id, usage_count desc);

-- ============================================================
-- 4. ITEM_TAGS — many-to-many tags on items
-- ============================================================
create table item_tags (
  id uuid primary key default gen_random_uuid(),
  context_item_id uuid not null references context_items(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  source text default 'user' check (source in ('user', 'ai')),
  confidence float default 1.0,
  added_at timestamptz default now(),
  unique(context_item_id, tag_id)
);

create index idx_item_tags_context on item_tags(context_item_id);
create index idx_item_tags_tag on item_tags(tag_id);

-- ============================================================
-- 5. ITEM_PINS — user-scoped pins for quick access
-- ============================================================
create table item_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_item_id uuid not null references context_items(id) on delete cascade,
  pinned_at timestamptz default now(),
  unique(user_id, context_item_id)
);

create index idx_item_pins_user_pinned on item_pins(user_id, pinned_at desc);

-- ============================================================
-- 6. ADD COLUMNS TO CONTEXT_ITEMS
-- ============================================================
alter table context_items add column archived_at timestamptz;
alter table context_items add column last_viewed_at timestamptz;
alter table context_items add column view_count int default 0;
alter table context_items add column ai_category text;
alter table context_items add column staleness_score float default 0;

create index idx_context_items_archived on context_items(org_id, archived_at) where archived_at is not null;
create index idx_context_items_staleness on context_items(org_id, staleness_score desc) where staleness_score > 0.5;

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

-- COLLECTIONS
alter table collections enable row level security;

create policy "collections_select" on collections for select using (
  org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
);

create policy "collections_insert" on collections for insert with check (
  org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
);

create policy "collections_update" on collections for update using (
  org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
);

create policy "collections_delete" on collections for delete using (
  org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
);

-- COLLECTION_ITEMS
alter table collection_items enable row level security;

create policy "collection_items_select" on collection_items for select using (
  collection_id in (
    select c.id from collections c
    where c.org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
  )
);

create policy "collection_items_insert" on collection_items for insert with check (
  collection_id in (
    select c.id from collections c
    where c.org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
  )
);

create policy "collection_items_update" on collection_items for update using (
  collection_id in (
    select c.id from collections c
    where c.org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
  )
);

create policy "collection_items_delete" on collection_items for delete using (
  collection_id in (
    select c.id from collections c
    where c.org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
  )
);

-- TAGS
alter table tags enable row level security;

create policy "tags_select" on tags for select using (
  org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
);

create policy "tags_insert" on tags for insert with check (
  org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
);

create policy "tags_update" on tags for update using (
  org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
);

create policy "tags_delete" on tags for delete using (
  org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
);

-- ITEM_TAGS
alter table item_tags enable row level security;

create policy "item_tags_select" on item_tags for select using (
  tag_id in (
    select t.id from tags t
    where t.org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
  )
);

create policy "item_tags_insert" on item_tags for insert with check (
  tag_id in (
    select t.id from tags t
    where t.org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
  )
);

create policy "item_tags_update" on item_tags for update using (
  tag_id in (
    select t.id from tags t
    where t.org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
  )
);

create policy "item_tags_delete" on item_tags for delete using (
  tag_id in (
    select t.id from tags t
    where t.org_id in (select om.org_id from org_members om where om.user_id = auth.uid())
  )
);

-- ITEM_PINS
alter table item_pins enable row level security;

create policy "item_pins_select" on item_pins for select using (
  user_id = auth.uid()
);

create policy "item_pins_insert" on item_pins for insert with check (
  user_id = auth.uid()
);

create policy "item_pins_update" on item_pins for update using (
  user_id = auth.uid()
);

create policy "item_pins_delete" on item_pins for delete using (
  user_id = auth.uid()
);
