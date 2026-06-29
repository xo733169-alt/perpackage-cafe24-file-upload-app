create extension if not exists pgcrypto;

create table if not exists public.cafe24_installations (
  id uuid primary key default gen_random_uuid(),
  mall_id text not null unique,
  shop_no text,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  scopes text,
  user_id text,
  user_type text,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'connected'
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  mall_id text,
  shop_no text,
  product_no text,
  variant_code text,
  customer_type text,
  customer_identifier text,
  original_filename text not null,
  stored_filename text not null,
  file_size bigint not null,
  mime_type text not null,
  storage_provider text not null,
  storage_bucket text not null,
  storage_path text not null,
  public_preview_url text,
  secure_download_url text,
  order_id text,
  inquiry_id text,
  status text not null default 'uploaded_pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists files_mall_id_idx on public.files (mall_id);
create index if not exists files_product_no_idx on public.files (product_no);
create index if not exists files_order_id_idx on public.files (order_id);
create index if not exists files_created_at_idx on public.files (created_at desc);

-- Phase 1 note:
-- Tokens are separated in cafe24_installations for future encryption.
-- Before production, replace plain token columns with encrypted values or
-- database-side encryption policy appropriate for the deployment environment.
