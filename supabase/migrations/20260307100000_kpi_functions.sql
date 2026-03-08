-- ============================================================
-- KPI FUNCTIONS: computed from existing tables, no new schema
-- ============================================================

-- 1. get_context_health: pipeline health metrics for an org
create or replace function get_context_health(p_org_id uuid)
returns jsonb
language sql
security definer
stable
as $$
  select jsonb_build_object(
    'pipeline', (
      select jsonb_build_object(
        'total',      count(*),
        'ready',      count(*) filter (where status = 'ready'),
        'error',      count(*) filter (where status = 'error'),
        'pending',    count(*) filter (where status = 'pending'),
        'processing', count(*) filter (where status = 'processing'),
        'success_rate',
          case when count(*) filter (where status in ('ready', 'error')) > 0
            then round(
              count(*) filter (where status = 'ready')::numeric /
              count(*) filter (where status in ('ready', 'error'))::numeric, 4
            )
            else 1.0
          end
      )
      from context_items
      where org_id = p_org_id
    ),
    'embedding_coverage', (
      select case when count(*) filter (where status = 'ready') > 0
        then round(
          count(*) filter (where status = 'ready' and embedding is not null)::numeric /
          count(*) filter (where status = 'ready')::numeric, 4
        )
        else 1.0
      end
      from context_items
      where org_id = p_org_id
    ),
    'content_completeness', (
      select case when count(*) filter (where status = 'ready') > 0
        then round(
          count(*) filter (
            where status = 'ready'
              and title is not null
              and description_short is not null
              and description_long is not null
              and raw_content is not null
          )::numeric /
          count(*) filter (where status = 'ready')::numeric, 4
        )
        else 1.0
      end
      from context_items
      where org_id = p_org_id
    ),
    'extraction_quality', (
      select jsonb_build_object(
        'has_entities', count(*) filter (
          where status = 'ready' and entities is not null and entities != 'null'::jsonb
        ),
        'has_topics', count(*) filter (
          where status = 'ready'
            and entities is not null
            and entities->'topics' is not null
            and jsonb_array_length(entities->'topics') > 0
        ),
        'has_action_items', count(*) filter (
          where status = 'ready'
            and entities is not null
            and entities->'action_items' is not null
            and jsonb_array_length(entities->'action_items') > 0
        ),
        'has_people', count(*) filter (
          where status = 'ready'
            and entities is not null
            and entities->'people' is not null
            and jsonb_array_length(entities->'people') > 0
        ),
        'has_decisions', count(*) filter (
          where status = 'ready'
            and entities is not null
            and entities->'decisions' is not null
            and jsonb_array_length(entities->'decisions') > 0
        ),
        'ready_count', count(*) filter (where status = 'ready'),
        'topics_rate', case when count(*) filter (where status = 'ready') > 0
          then round(
            count(*) filter (
              where status = 'ready'
                and entities is not null
                and entities->'topics' is not null
                and jsonb_array_length(entities->'topics') > 0
            )::numeric /
            count(*) filter (where status = 'ready')::numeric, 4
          )
          else 0.0
        end
      )
      from context_items
      where org_id = p_org_id
    ),
    'freshness', (
      select jsonb_build_object(
        'oldest_pending', (
          select ingested_at
          from context_items
          where org_id = p_org_id and status in ('pending', 'processing')
          order by ingested_at asc
          limit 1
        ),
        'newest_ready', (
          select processed_at
          from context_items
          where org_id = p_org_id and status = 'ready'
          order by processed_at desc
          limit 1
        )
      )
    ),
    'by_source', (
      select coalesce(jsonb_agg(row_to_json(s)::jsonb), '[]'::jsonb)
      from (
        select
          source_type,
          count(*) as total,
          count(*) filter (where status = 'ready') as ready,
          count(*) filter (where status = 'error') as error_count,
          count(*) filter (where status = 'pending') as pending,
          count(*) filter (where status = 'processing') as processing,
          case when count(*) filter (where status in ('ready', 'error')) > 0
            then round(
              count(*) filter (where status = 'ready')::numeric /
              count(*) filter (where status in ('ready', 'error'))::numeric, 4
            )
            else 1.0
          end as success_rate
        from context_items
        where org_id = p_org_id
        group by source_type
        order by total desc
      ) s
    )
  )
$$;


-- 2. get_integration_health: per-provider integration status
create or replace function get_integration_health(p_org_id uuid)
returns jsonb
language sql
security definer
stable
as $$
  select coalesce(jsonb_agg(row_to_json(i)::jsonb), '[]'::jsonb)
  from (
    select
      ig.provider,
      ig.status,
      ig.last_sync_at,
      extract(epoch from (now() - ig.last_sync_at)) / 3600.0 as hours_since_sync,
      coalesce(ci.item_count, 0) as item_count,
      coalesce(ci.error_count, 0) as error_count
    from integrations ig
    left join lateral (
      select
        count(*) as item_count,
        count(*) filter (where status = 'error') as error_count
      from context_items
      where org_id = p_org_id
        and nango_connection_id = ig.nango_connection_id
    ) ci on true
    where ig.org_id = p_org_id
    order by ig.provider
  ) i
$$;


-- 3. get_agent_metrics: agent run analytics with trends
create or replace function get_agent_metrics(p_org_id uuid, p_since timestamptz default now() - interval '30 days')
returns jsonb
language sql
security definer
stable
as $$
  select jsonb_build_object(
    'total_runs', (
      select count(*)
      from agent_runs
      where org_id = p_org_id and created_at >= p_since
    ),
    'rates', (
      select jsonb_build_object(
        'search_utilization', case when count(*) > 0
          then round(
            count(*) filter (
              where tool_calls::text like '%search_context%'
            )::numeric / count(*)::numeric, 4
          )
          else 0.0
        end,
        'no_tool', case when count(*) > 0
          then round(
            count(*) filter (
              where tool_calls = '[]'::jsonb or tool_calls is null
            )::numeric / count(*)::numeric, 4
          )
          else 0.0
        end,
        'error', case when count(*) > 0
          then round(
            count(*) filter (where error is not null)::numeric / count(*)::numeric, 4
          )
          else 0.0
        end,
        'step_limit', case when count(*) > 0
          then round(
            count(*) filter (where step_count >= 6)::numeric / count(*)::numeric, 4
          )
          else 0.0
        end,
        'doc_retrieval', case when count(*) > 0
          then round(
            count(*) filter (
              where tool_calls::text like '%get_document%'
            )::numeric / count(*)::numeric, 4
          )
          else 0.0
        end
      )
      from agent_runs
      where org_id = p_org_id and created_at >= p_since
    ),
    'averages', (
      select jsonb_build_object(
        'steps', round(avg(step_count)::numeric, 2),
        'input_tokens', round(avg(coalesce(total_input_tokens, 0))::numeric, 0),
        'output_tokens', round(avg(coalesce(total_output_tokens, 0))::numeric, 0),
        'duration_ms', round(avg(coalesce(duration_ms, 0))::numeric, 0)
      )
      from agent_runs
      where org_id = p_org_id and created_at >= p_since
    ),
    'by_model', (
      select coalesce(jsonb_agg(row_to_json(m)::jsonb), '[]'::jsonb)
      from (
        select
          model,
          count(*) as runs,
          round(avg(step_count)::numeric, 2) as avg_steps,
          round(avg(coalesce(duration_ms, 0))::numeric, 0) as avg_duration_ms,
          count(*) filter (where error is not null) as errors
        from agent_runs
        where org_id = p_org_id and created_at >= p_since
        group by model
        order by runs desc
      ) m
    ),
    'daily_trend', (
      select coalesce(jsonb_agg(row_to_json(d)::jsonb order by d.day), '[]'::jsonb)
      from (
        select
          date_trunc('day', created_at)::date as day,
          count(*) as runs,
          count(*) filter (where error is not null) as errors,
          round(avg(coalesce(duration_ms, 0))::numeric, 0) as avg_duration_ms
        from agent_runs
        where org_id = p_org_id
          and created_at >= (now() - interval '14 days')
        group by date_trunc('day', created_at)::date
        order by day
      ) d
    )
  )
$$;
