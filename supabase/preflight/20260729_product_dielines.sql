-- Run this once in Supabase SQL Editor before deploying the dieline feature.
-- Naver Object Storage objects remain private. Only server-side signed URLs are issued.

create table if not exists public.product_dielines (
  id uuid primary key default gen_random_uuid(),
  product_no text not null,
  size_key text not null,
  ai_storage_bucket text,
  ai_storage_path text,
  ai_filename text,
  pdf_storage_bucket text,
  pdf_storage_path text,
  pdf_filename text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_dielines_product_size_unique unique (product_no, size_key),
  constraint product_dielines_size_key_check check (size_key ~ '^[0-9]+([.][0-9]+)?x[0-9]+([.][0-9]+)?x[0-9]+([.][0-9]+)?$')
);

create index if not exists product_dielines_lookup_idx
  on public.product_dielines (product_no, size_key)
  where is_active = true;

-- Register the three product 65 test sizes after uploading the private files.
-- Replace every <...> value with the actual bucket, object key, and download filename.
-- Do not store a public URL or signed URL in this table.
--
-- insert into public.product_dielines (
--   product_no, size_key,
--   ai_storage_bucket, ai_storage_path, ai_filename,
--   pdf_storage_bucket, pdf_storage_path, pdf_filename
-- ) values
-- ('65', '100x80x70', '<bucket>', '<private-ai-object-key>', '<download-name>.ai', '<bucket>', '<private-pdf-object-key>', '<download-name>.pdf'),
-- ('65', '140x110x90', '<bucket>', '<private-ai-object-key>', '<download-name>.ai', '<bucket>', '<private-pdf-object-key>', '<download-name>.pdf'),
-- ('65', '180x130x110', '<bucket>', '<private-ai-object-key>', '<download-name>.ai', '<bucket>', '<private-pdf-object-key>', '<download-name>.pdf')
-- on conflict (product_no, size_key) do update set
--   ai_storage_bucket = excluded.ai_storage_bucket,
--   ai_storage_path = excluded.ai_storage_path,
--   ai_filename = excluded.ai_filename,
--   pdf_storage_bucket = excluded.pdf_storage_bucket,
--   pdf_storage_path = excluded.pdf_storage_path,
--   pdf_filename = excluded.pdf_filename,
--   is_active = true,
--   updated_at = now();
