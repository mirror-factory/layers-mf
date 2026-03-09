-- ============================================================
-- AUDIT LOG
-- Tracks user and system actions for compliance and debugging
-- ============================================================
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_org_created on audit_log(org_id, created_at desc);

-- RLS
alter table audit_log enable row level security;

create policy "org members can read audit_log"
  on audit_log for select
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = audit_log.org_id
        and org_members.user_id = auth.uid()
    )
  );
