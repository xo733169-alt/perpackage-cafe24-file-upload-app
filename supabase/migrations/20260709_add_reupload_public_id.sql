alter table if exists public.file_reupload_requests
  add column if not exists public_id text;

create unique index if not exists file_reupload_requests_public_id_key
  on public.file_reupload_requests(public_id)
  where public_id is not null;
