-- Auto-create organization and member record when a user signs up
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
begin
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
