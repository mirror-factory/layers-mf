-- Unique constraint for deduplicating external source items
-- (org_id, source_type, source_id) — only when source_id is not null
create unique index context_items_source_unique
  on context_items (org_id, source_type, source_id)
  where source_id is not null;
