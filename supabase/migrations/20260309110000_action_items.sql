-- ============================================================
-- ACTION ITEM TRACKING
-- ============================================================

-- Tracks status of action items extracted from context_items.entities
create table action_item_status (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  context_item_id uuid not null references context_items(id) on delete cascade,
  action_index int not null, -- index within entities.action_items array
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  unique(context_item_id, action_index)
);

create index on action_item_status(org_id, status);
create index on action_item_status(context_item_id);

-- RLS
alter table action_item_status enable row level security;

create policy "Users can view org action item statuses"
  on action_item_status for select
  using (org_id in (select get_user_org_ids()));

create policy "Users can manage org action item statuses"
  on action_item_status for all
  using (org_id in (select get_user_org_ids()));

-- Function: get action items with status across all context items
create or replace function get_action_items(
  p_org_id uuid,
  p_status text default null,
  p_source_type text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  context_item_id uuid,
  action_index int,
  task text,
  status text,
  source_type text,
  content_type text,
  source_title text,
  source_created_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
stable
as $$
  select
    ci.id as context_item_id,
    idx.ordinality - 1 as action_index,
    idx.val::text as task,
    coalesce(ais.status, 'pending') as status,
    ci.source_type,
    ci.content_type,
    ci.title as source_title,
    ci.source_created_at,
    ais.completed_at
  from context_items ci,
    lateral jsonb_array_elements(ci.entities->'action_items') with ordinality as idx(val, ordinality)
  left join action_item_status ais
    on ais.context_item_id = ci.id
    and ais.action_index = idx.ordinality - 1
  where ci.org_id = p_org_id
    and ci.status = 'ready'
    and ci.entities is not null
    and jsonb_array_length(coalesce(ci.entities->'action_items', '[]'::jsonb)) > 0
    and (p_status is null or coalesce(ais.status, 'pending') = p_status)
    and (p_source_type is null or ci.source_type = p_source_type)
  order by ci.source_created_at desc nulls last, idx.ordinality
  limit p_limit
  offset p_offset
$$;
