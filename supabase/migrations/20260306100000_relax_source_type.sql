-- Drop the strict source_type CHECK constraint so we can store any Nango provider.
-- Nango integrations include google-drive, github, slack, etc. which weren't in
-- the original allowed list. We keep the column non-null for data integrity.

alter table context_items
  drop constraint if exists context_items_source_type_check;
