-- Drop any CHECK constraints on context_items.source_type by querying pg_constraint.
-- The inline CHECK in the initial schema may have been named differently than expected.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'context_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source_type%'
  LOOP
    EXECUTE format('ALTER TABLE context_items DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- Also drop any CHECK constraint on content_type so we can store new types freely.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'context_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%content_type%'
  LOOP
    EXECUTE format('ALTER TABLE context_items DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;
