-- Create the "portals" storage bucket for portal PDF files.
-- Public bucket: PDFs are served directly to anyone with the share link.
-- RLS on document_portals still controls who can access the portal data itself.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portals',
  'portals',
  true,
  52428800,  -- 50 MB
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Allow authenticated users to upload to their org's folder
create policy "org members can upload portal pdfs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portals'
  );

-- Allow authenticated users to update/delete their own uploads
create policy "org members can manage portal pdfs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portals'
  );

-- Public read — anyone with the URL can read portal PDFs
create policy "public can read portal pdfs"
  on storage.objects for select
  to public
  using (bucket_id = 'portals');
