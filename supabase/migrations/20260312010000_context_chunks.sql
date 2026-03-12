-- Context chunks: parent-child chunking for scalable vector search
CREATE TABLE context_chunks (
  id uuid DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  context_item_id uuid NOT NULL REFERENCES context_items(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  parent_content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  embedding vector(1536),
  search_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', content)
  ) STORED,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX idx_chunks_context_item ON context_chunks (context_item_id);
CREATE INDEX idx_chunks_org ON context_chunks (org_id);
CREATE INDEX idx_chunks_embedding ON context_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_search_tsv ON context_chunks USING gin (search_tsv);

-- RLS
ALTER TABLE context_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org chunks" ON context_chunks
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
