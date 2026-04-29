-- Add prompt caching columns to agent_runs
-- Tracks cache read/write tokens per agent run for cost optimization analytics
alter table agent_runs add column if not exists cache_read_tokens integer default 0;
alter table agent_runs add column if not exists cache_write_tokens integer default 0;
alter table agent_runs add column if not exists conversation_id uuid;
alter table agent_runs add column if not exists gateway_cost_usd numeric(10,6) default 0;
alter table agent_runs add column if not exists step_details jsonb not null default '[]'::jsonb;
