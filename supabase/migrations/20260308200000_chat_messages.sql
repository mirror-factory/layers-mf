-- ============================================================
-- CHAT MESSAGES
-- Persists chat messages so conversations survive page refresh
-- ============================================================
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade, -- null = global /chat
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null default '[]'::jsonb,                -- UIMessage parts array
  model text,                                                -- model used (assistant msgs only)
  created_at timestamptz not null default now()
);

-- Fast lookups: org global chat and session-scoped chat
create index chat_messages_org_global on chat_messages(org_id, created_at)
  where session_id is null;
create index chat_messages_session on chat_messages(session_id, created_at)
  where session_id is not null;

-- RLS
alter table chat_messages enable row level security;

-- Org members can read their org's messages
create policy "org members can read chat_messages"
  on chat_messages for select
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = chat_messages.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Messages are inserted server-side only (service role key), no user insert policy needed
