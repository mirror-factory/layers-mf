-- Hybrid search on context_chunks using RRF (Reciprocal Rank Fusion)
-- Searches child chunks for precision, returns parent_content for LLM context
-- Deduplicates: max 2 chunks per document in results

CREATE OR REPLACE FUNCTION hybrid_search_chunks(
  p_org_id          uuid,
  p_query_text      text,
  p_query_embedding vector(1536),
  p_limit           int DEFAULT 10,
  p_source_type     text DEFAULT NULL,
  p_content_type    text DEFAULT NULL,
  p_date_from       timestamptz DEFAULT NULL,
  p_date_to         timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id                uuid,
  context_item_id   uuid,
  title             text,
  description_short text,
  parent_content    text,
  source_type       text,
  content_type      text,
  source_url        text,
  source_created_at timestamptz,
  rrf_score         float
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH semantic AS (
    SELECT
      cc.id,
      cc.context_item_id,
      ROW_NUMBER() OVER (ORDER BY cc.embedding <=> p_query_embedding) AS rank
    FROM context_chunks cc
    JOIN context_items ci ON ci.id = cc.context_item_id
    WHERE cc.org_id = p_org_id
      AND ci.status = 'ready'
      AND cc.embedding IS NOT NULL
      AND (p_source_type IS NULL OR ci.source_type = p_source_type)
      AND (p_content_type IS NULL OR ci.content_type = p_content_type)
      AND (p_date_from IS NULL OR ci.source_created_at >= p_date_from)
      AND (p_date_to IS NULL OR ci.source_created_at <= p_date_to)
    ORDER BY cc.embedding <=> p_query_embedding
    LIMIT p_limit * 3
  ),
  fulltext AS (
    SELECT
      cc.id,
      cc.context_item_id,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(cc.search_tsv, plainto_tsquery('english', p_query_text)) DESC
      ) AS rank
    FROM context_chunks cc
    JOIN context_items ci ON ci.id = cc.context_item_id
    WHERE cc.org_id = p_org_id
      AND ci.status = 'ready'
      AND cc.search_tsv @@ plainto_tsquery('english', p_query_text)
      AND (p_source_type IS NULL OR ci.source_type = p_source_type)
      AND (p_content_type IS NULL OR ci.content_type = p_content_type)
      AND (p_date_from IS NULL OR ci.source_created_at >= p_date_from)
      AND (p_date_to IS NULL OR ci.source_created_at <= p_date_to)
    LIMIT p_limit * 3
  ),
  rrf AS (
    SELECT
      COALESCE(s.id, f.id) AS id,
      COALESCE(s.context_item_id, f.context_item_id) AS context_item_id,
      COALESCE(1.0 / (60.0 + s.rank), 0.0) +
      COALESCE(1.0 / (60.0 + f.rank), 0.0) AS score
    FROM semantic s
    FULL OUTER JOIN fulltext f ON s.id = f.id
  ),
  -- Dedup: max 2 chunks per document, take highest scoring
  ranked AS (
    SELECT
      r.*,
      ROW_NUMBER() OVER (PARTITION BY r.context_item_id ORDER BY r.score DESC) AS doc_rank
    FROM rrf r
  )
  SELECT
    rk.id,
    rk.context_item_id,
    ci.title,
    ci.description_short,
    cc.parent_content,
    ci.source_type,
    ci.content_type,
    ci.source_metadata->>'url' AS source_url,
    ci.source_created_at,
    rk.score AS rrf_score
  FROM ranked rk
  JOIN context_items ci ON ci.id = rk.context_item_id
  JOIN context_chunks cc ON cc.id = rk.id
  WHERE rk.doc_rank <= 2
  ORDER BY rk.score DESC
  LIMIT p_limit;
$$;
