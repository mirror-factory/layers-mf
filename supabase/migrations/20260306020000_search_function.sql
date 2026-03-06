-- ============================================================
-- HYBRID SEARCH: vector cosine + full-text BM25 via RRF
-- ============================================================

-- search_context_items: combines semantic + keyword search using
-- Reciprocal Rank Fusion (k=60). Returns top results ranked by score.
create or replace function search_context_items(
  p_org_id          uuid,
  p_query_text      text,
  p_query_embedding vector(1536),
  p_limit           int default 10
)
returns table (
  id                uuid,
  title             text,
  description_short text,
  description_long  text,
  source_type       text,
  content_type      text,
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
    order by ci.embedding <=> p_query_embedding
    limit p_limit * 2
  ),
  fulltext as (
    select
      ci.id,
      row_number() over (
        order by ts_rank_cd(
          to_tsvector('english',
            coalesce(ci.title, '') || ' ' ||
            coalesce(ci.description_long, '') || ' ' ||
            coalesce(ci.raw_content, '')
          ),
          plainto_tsquery('english', p_query_text)
        ) desc
      ) as rank
    from context_items ci
    where ci.org_id = p_org_id
      and ci.status = 'ready'
      and to_tsvector('english',
            coalesce(ci.title, '') || ' ' ||
            coalesce(ci.description_long, '') || ' ' ||
            coalesce(ci.raw_content, '')
          ) @@ plainto_tsquery('english', p_query_text)
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
    r.score as rrf_score
  from rrf r
  join context_items ci on ci.id = r.id
  order by r.score desc
  limit p_limit
$$;

-- Text-only fallback (no embedding required)
create or replace function search_context_items_text(
  p_org_id     uuid,
  p_query_text text,
  p_limit      int default 10
)
returns table (
  id                uuid,
  title             text,
  description_short text,
  description_long  text,
  source_type       text,
  content_type      text,
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
    ts_rank_cd(
      to_tsvector('english',
        coalesce(ci.title, '') || ' ' ||
        coalesce(ci.description_long, '') || ' ' ||
        coalesce(ci.raw_content, '')
      ),
      plainto_tsquery('english', p_query_text)
    )::float as rrf_score
  from context_items ci
  where ci.org_id = p_org_id
    and ci.status = 'ready'
    and to_tsvector('english',
          coalesce(ci.title, '') || ' ' ||
          coalesce(ci.description_long, '') || ' ' ||
          coalesce(ci.raw_content, '')
        ) @@ plainto_tsquery('english', p_query_text)
  order by rrf_score desc
  limit p_limit
$$;
