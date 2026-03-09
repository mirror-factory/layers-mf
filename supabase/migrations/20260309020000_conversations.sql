-- ============================================================
-- CONVERSATIONS
-- Multi-conversation support for chat
-- ============================================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_org on conversations(org_id, updated_at desc);
create index conversations_user on conversations(user_id, updated_at desc);

-- RLS
alter table conversations enable row level security;

create policy "org members can read conversations"
  on conversations for select
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = conversations.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Add conversation_id to chat_messages
alter table chat_messages add column conversation_id uuid references conversations(id) on delete cascade;

create index chat_messages_conversation on chat_messages(conversation_id, created_at)
  where conversation_id is not null;
