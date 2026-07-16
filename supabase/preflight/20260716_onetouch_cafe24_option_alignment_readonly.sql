-- Read-only preflight for the ONE_TOUCH_BOX Cafe24 option sync candidate.
-- Run this manually in the Supabase SQL Editor. It does not write, update,
-- activate, or deactivate any quote or Cafe24 data.
--
-- Purpose:
-- 1. List the materials currently used by the active ONE_TOUCH_BOX quote version.
-- 2. Show price-row coverage by size and material.
-- 3. Compare the quote material display names with the five current Cafe24
--    product option values for product_no=76.
--
-- Do not enable customer selection sync until every customer-facing material
-- has an approved Cafe24 option value with the same physical specification.

with active_version as (
  select
    p.id as product_id,
    pv.id as price_version_id
  from public.quote_products p
  join public.quote_price_versions pv
    on pv.product_id = p.id
  where p.product_code = 'ONE_TOUCH_BOX'
    and p.is_active = true
    and pv.status = 'active'
),
cafe24_material_options(cafe24_label) as (
  values
    ('로얄아이보리지'),
    ('크라프트지'),
    ('밤부팩(내추럴)'),
    ('올드밀(리사이클)'),
    ('에그쉘팩')
),
quote_materials as (
  select
    m.id,
    m.material_code,
    m.display_name,
    m.basis_weight_gsm
  from public.quote_materials m
  where m.is_active = true
),
price_coverage as (
  select
    pm.material_id,
    count(*) as active_price_rows,
    count(distinct pm.size_id) as covered_size_count
  from public.quote_price_matrix pm
  join active_version av
    on av.product_id = pm.product_id
   and av.price_version_id = pm.price_version_id
  group by pm.material_id
)
select
  qm.material_code,
  qm.display_name as quote_material_label,
  qm.basis_weight_gsm,
  coalesce(pc.active_price_rows, 0) as active_price_rows,
  coalesce(pc.covered_size_count, 0) as covered_size_count,
  case
    when exists (
      select 1
      from cafe24_material_options cmo
      where cmo.cafe24_label = qm.display_name
    ) then 'exact_match'
    else 'needs_mapping_or_option_change'
  end as cafe24_alignment
from quote_materials qm
left join price_coverage pc
  on pc.material_id = qm.id
where exists (
  select 1
  from public.quote_product_size_materials psm
  join active_version av
    on av.product_id = psm.product_id
  where psm.material_id = qm.id
    and psm.is_active = true
)
order by qm.display_name;

-- Detail query: each active size/material pair used by the quote widget.
with active_version as (
  select
    p.id as product_id,
    pv.id as price_version_id
  from public.quote_products p
  join public.quote_price_versions pv
    on pv.product_id = p.id
  where p.product_code = 'ONE_TOUCH_BOX'
    and p.is_active = true
    and pv.status = 'active'
)
select
  s.size_code,
  s.display_name as quote_size_label,
  m.material_code,
  m.display_name as quote_material_label,
  m.basis_weight_gsm,
  count(pm.id) as price_rows_for_pair
from public.quote_product_size_materials psm
join active_version av
  on av.product_id = psm.product_id
join public.quote_product_sizes s
  on s.id = psm.size_id
join public.quote_materials m
  on m.id = psm.material_id
left join public.quote_price_matrix pm
  on pm.product_id = av.product_id
 and pm.price_version_id = av.price_version_id
 and pm.size_id = psm.size_id
 and pm.material_id = psm.material_id
where psm.is_active = true
  and s.is_active = true
  and m.is_active = true
group by
  s.size_code,
  s.display_name,
  s.sort_order,
  m.material_code,
  m.display_name,
  m.basis_weight_gsm
order by s.sort_order, m.display_name;
