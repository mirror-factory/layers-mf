-- ============================================================
-- ORG INVITATIONS
-- ============================================================
create table org_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  unique(org_id, email)
);

create index on org_invitations(email, status);

-- RLS
alter table org_invitations enable row level security;

create policy "Org members can view their org invitations"
  on org_invitations for select
  using (org_id in (select get_user_org_ids()));

-- ============================================================
-- ACCEPT INVITATION RPC
-- ============================================================
create or replace function accept_invitation(invitation_id uuid, accepting_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
begin
  select * into inv
  from org_invitations
  where id = invitation_id and status = 'pending';

  if not found then
    raise exception 'Invitation not found or already used';
  end if;

  -- Insert org member
  insert into org_members (org_id, user_id, role)
  values (inv.org_id, accepting_user_id, inv.role)
  on conflict (org_id, user_id) do nothing;

  -- Mark invitation accepted
  update org_invitations
  set status = 'accepted', accepted_at = now()
  where id = invitation_id;
end;
$$;

-- ============================================================
-- MODIFY handle_new_user() — skip auto-org when pending invite exists
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  org_name text;
  org_slug text;
  has_invite boolean;
begin
  -- Check if this user has a pending invitation
  select exists(
    select 1 from org_invitations
    where email = new.email and status = 'pending'
  ) into has_invite;

  -- If invited, skip auto-org creation — callback will handle membership
  if has_invite then
    return new;
  end if;

  -- Get org name from user metadata, fallback to email prefix
  org_name := coalesce(
    new.raw_user_meta_data->>'org_name',
    split_part(new.email, '@', 1)
  );

  -- Generate a unique slug
  org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]', '-', 'g'));

  -- Ensure slug is unique by appending random suffix if needed
  while exists (select 1 from organizations where slug = org_slug) loop
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
  end loop;

  -- Create organization
  insert into organizations (name, slug)
  values (org_name, org_slug)
  returning id into org_id;

  -- Add user as owner
  insert into org_members (org_id, user_id, role)
  values (org_id, new.id, 'owner');

  return new;
end;
$$;
