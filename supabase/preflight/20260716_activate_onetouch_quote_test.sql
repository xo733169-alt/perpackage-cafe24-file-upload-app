-- Run manually in the Supabase SQL Editor only after reviewing the imported prices.
-- Purpose: make the ONE_TOUCH_BOX quote API available for the Cafe24 test product.
-- This does not change Cafe24 product settings, options, or sold-out status.

begin;

do $$
declare
  target_product_id uuid;
  target_price_version_id uuid;
  price_row_count integer;
  other_active_version_count integer;
begin
  select p.id into target_product_id
  from public.quote_products p
  where p.product_code = 'ONE_TOUCH_BOX';

  if target_product_id is null then
    raise exception 'ONE_TOUCH_BOX product was not found.';
  end if;

  select pv.id into target_price_version_id
  from public.quote_price_versions pv
  where pv.product_id = target_product_id
    and pv.version_no = 1
    and pv.status = 'draft';

  if target_price_version_id is null then
    raise exception 'Draft price version 1 for ONE_TOUCH_BOX was not found.';
  end if;

  select count(*) into price_row_count
  from public.quote_price_matrix pm
  where pm.price_version_id = target_price_version_id;

  if price_row_count <> 600 then
    raise exception 'Expected 600 price rows, found %.', price_row_count;
  end if;

  select count(*) into other_active_version_count
  from public.quote_price_versions pv
  where pv.product_id = target_product_id
    and pv.status = 'active'
    and pv.id <> target_price_version_id;

  if other_active_version_count <> 0 then
    raise exception 'Another active price version already exists.';
  end if;
end $$;

update public.quote_price_versions pv
set
  status = 'active',
  effective_from = coalesce(pv.effective_from, now())
from public.quote_products p
where p.id = pv.product_id
  and p.product_code = 'ONE_TOUCH_BOX'
  and pv.version_no = 1
  and pv.status = 'draft';

update public.quote_products
set
  is_active = true,
  updated_at = now()
where product_code = 'ONE_TOUCH_BOX';

commit;

-- Verification query. Expected: is_active = true, status = active, price_rows = 600.
select
  p.product_code,
  p.display_name,
  p.is_active,
  pv.version_no,
  pv.status,
  count(pm.id) as price_rows
from public.quote_products p
join public.quote_price_versions pv
  on pv.product_id = p.id
left join public.quote_price_matrix pm
  on pm.price_version_id = pv.id
where p.product_code = 'ONE_TOUCH_BOX'
group by
  p.product_code,
  p.display_name,
  p.is_active,
  pv.version_no,
  pv.status;
