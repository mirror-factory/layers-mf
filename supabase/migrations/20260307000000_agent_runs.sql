-- ============================================================
-- AGENT RUNS
-- Tracks every agentic chat request for analytics and quality
-- ============================================================
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Request info
  model text not null,
  query text not null,                          -- first user message of the run

  -- Outcome
  step_count integer not null default 0,
  finish_reason text,                            -- e.g. "stop", "step-limit"
  total_input_tokens integer,
  total_output_tokens integer,
  duration_ms integer,

  -- Tool usage detail (array of {tool, count})
  tool_calls jsonb not null default '[]'::jsonb,

  -- Error if any
  error text
);

-- Indexes for analytics queries
create index agent_runs_org_created on agent_runs(org_id, created_at desc);
create index agent_runs_model on agent_runs(model);

-- RLS
alter table agent_runs enable row level security;

-- Org members can read their org's runs
create policy "org members can read agent_runs"
  on agent_runs for select
  using (
    exists (
      select 1 from org_members
      where org_members.org_id = agent_runs.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Runs are inserted server-side only (service role key), no user insert policy needed
