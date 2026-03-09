-- ============================================================
-- HYBRID SEARCH UPGRADE: stored tsvector + filter support
-- ============================================================

-- 1. Add materialized tsvector column for fast full-text search
alter table context_items
  add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(description_long, '') || ' ' ||
      coalesce(raw_content, '')
    )
  ) stored;

-- 2. GIN index on the stored tsvector column
create index if not exists idx_context_items_search_tsv
  on context_items using gin(search_tsv);

-- 3. Replace hybrid search function with filter support
create or replace function hybrid_search(
  p_org_id          uuid,
  p_query_text      text,
  p_query_embedding vector(1536),
  p_limit           int default 10,
  p_source_type     text default null,
  p_content_type    text default null,
  p_date_from       timestamptz default null,
  p_date_to         timestamptz default null
)
returns table (
  id                uuid,
  title             text,
  description_short text,
  description_long  text,
  source_type       text,
  content_type      text,
  source_url        text,
  rrf_score         float
)
language sql
security definer
stable
as $$
  with semantic as (
    select
      ci.id,
      row_number() over (order by ci.embedding <=> p_query_embedding) as rank
    from context_items ci
    where ci.org_id = p_org_id
      and ci.status = 'ready'
      and ci.embedding is not null
      and (p_source_type is null or ci.source_type = p_source_type)
      and (p_content_type is null or ci.content_type = p_content_type)
      and (p_date_from is null or ci.source_created_at >= p_date_from)
      and (p_date_to is null or ci.source_created_at <= p_date_to)
    order by ci.embedding <=> p_query_embedding
    limit p_limit * 2
  ),
  fulltext as (
    select
      ci.id,
      row_number() over (
        order by ts_rank_cd(ci.search_tsv, plainto_tsquery('english', p_query_text)) desc
      ) as rank
    from context_items ci
    where ci.org_id = p_org_id
      and ci.status = 'ready'
      and ci.search_tsv @@ plainto_tsquery('english', p_query_text)
      and (p_source_type is null or ci.source_type = p_source_type)
      and (p_content_type is null or ci.content_type = p_content_type)
      and (p_date_from is null or ci.source_created_at >= p_date_from)
      and (p_date_to is null or ci.source_created_at <= p_date_to)
    limit p_limit * 2
  ),
  rrf as (
    select
      coalesce(s.id, f.id) as id,
      coalesce(1.0 / (60.0 + s.rank), 0.0) +
      coalesce(1.0 / (60.0 + f.rank), 0.0) as score
    from semantic s
    full outer join fulltext f on s.id = f.id
  )
  select
    ci.id,
    ci.title,
    ci.description_short,
    ci.description_long,
    ci.source_type,
    ci.content_type,
    ci.source_metadata->>'url' as source_url,
    r.score as rrf_score
  from rrf r
  join context_items ci on ci.id = r.id
  order by r.score desc
  limit p_limit
$$;

-- 4. Text-only fallback with filter support
create or replace function hybrid_search_text(
  p_org_id      uuid,
  p_query_text  text,
  p_limit       int default 10,
  p_source_type text default null,
  p_content_type text default null,
  p_date_from   timestamptz default null,
  p_date_to     timestamptz default null
)
returns table (
  id                uuid,
  title             text,
  description_short text,
  description_long  text,
  source_type       text,
  content_type      text,
  source_url        text,
  rrf_score         float
)
language sql
security definer
stable
as $$
  select
    ci.id,
    ci.title,
    ci.description_short,
    ci.description_long,
    ci.source_type,
    ci.content_type,
    ci.source_metadata->>'url' as source_url,
    ts_rank_cd(ci.search_tsv, plainto_tsquery('english', p_query_text))::float as rrf_score
  from context_items ci
  where ci.org_id = p_org_id
    and ci.status = 'ready'
    and ci.search_tsv @@ plainto_tsquery('english', p_query_text)
    and (p_source_type is null or ci.source_type = p_source_type)
    and (p_content_type is null or ci.content_type = p_content_type)
    and (p_date_from is null or ci.source_created_at >= p_date_from)
    and (p_date_to is null or ci.source_created_at <= p_date_to)
  order by rrf_score desc
  limit p_limit
$$;
