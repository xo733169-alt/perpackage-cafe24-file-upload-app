-- Read-only preflight for syncing ONE_TOUCH_BOX quote prices to Cafe24 variants.
-- Run manually in the Supabase SQL Editor. This script does not write to
-- Supabase, Cafe24, or the quote tables.
--
-- Cafe24 variant selling price model used by the next phase:
--   Cafe24 product base price + variant additional_amount = quote total price
--
-- The recommended base price is the minimum active quote price. Every other
-- variant amount is then a non-negative additional amount. Do not change the
-- Cafe24 product price or variant prices from this output yet.

with active_version as (
  select
    p.id as product_id,
    p.product_code,
    p.display_name as product_name,
    pv.id as price_version_id,
    pv.version_no
  from public.quote_products p
  join public.quote_price_versions pv
    on pv.product_id = p.id
  where p.product_code = 'ONE_TOUCH_BOX'
    and p.is_active = true
    and pv.status = 'active'
),
quote_rows as (
  select
    av.product_code,
    av.product_name,
    av.version_no,
    s.size_code,
    s.display_name as size_label,
    m.material_code,
    m.display_name as material_label,
    q.quantity,
    po.option_code as print_option_code,
    po.display_name as print_label,
    fo.option_code as finish_option_code,
    fo.display_name as finish_label,
    pm.vat_inclusive_price,
    pm.unit_price,
    case
      when m.material_code in ('AB_LIGHT_250', 'AB_LIGHT_270') then 'AB라이트'
      when m.material_code in ('BAMBOO_NATURAL_300', 'BAMBOO_NATURAL_350') then '밤부팩(내추럴)'
      when m.material_code in ('EGGSHELL_300', 'EGGSHELL_350') then '에그쉘팩'
      when m.material_code in ('OLD_MILL_RECYCLE_300', 'OLD_MILL_RECYCLE_350') then '올드밀(리사이클)'
      when m.material_code in ('KRAFT_300', 'KRAFT_350') then '크라프트지'
      else null
    end as cafe24_material_value
  from active_version av
  join public.quote_price_matrix pm
    on pm.product_id = av.product_id
   and pm.price_version_id = av.price_version_id
  join public.quote_product_sizes s on s.id = pm.size_id
  join public.quote_materials m on m.id = pm.material_id
  join public.quote_product_quantities q on q.id = pm.quantity_option_id
  join public.quote_product_print_options po on po.id = pm.print_option_id
  join public.quote_product_finish_options fo on fo.id = pm.finish_option_id
),
price_bounds as (
  select min(vat_inclusive_price) as recommended_base_price
  from quote_rows
),
prepared_rows as (
  select
    qr.*,
    pb.recommended_base_price,
    qr.vat_inclusive_price - pb.recommended_base_price as recommended_additional_amount,
    concat_ws('|',
      qr.cafe24_material_value,
      qr.size_label,
      qr.quantity::text,
      qr.print_label,
      qr.finish_label
    ) as cafe24_option_key
  from quote_rows qr
  cross join price_bounds pb
)
select
  product_code,
  product_name,
  version_no,
  size_code,
  size_label as cafe24_size_value,
  material_code,
  material_label as quote_material_label,
  cafe24_material_value,
  quantity as cafe24_quantity_value,
  print_option_code,
  print_label as cafe24_print_value,
  finish_option_code,
  finish_label as cafe24_finish_value,
  vat_inclusive_price as quote_total_price,
  unit_price,
  recommended_base_price,
  recommended_additional_amount,
  cafe24_option_key
from prepared_rows
order by size_code, cafe24_material_value, quantity, print_option_code, finish_option_code;

-- Coverage and safety checks. All counts must be reviewed before any Cafe24 write.
with active_version as (
  select p.id as product_id, pv.id as price_version_id
  from public.quote_products p
  join public.quote_price_versions pv on pv.product_id = p.id
  where p.product_code = 'ONE_TOUCH_BOX'
    and p.is_active = true
    and pv.status = 'active'
),
quote_rows as (
  select
    pm.vat_inclusive_price,
    case
      when m.material_code in ('AB_LIGHT_250', 'AB_LIGHT_270') then 'AB라이트'
      when m.material_code in ('BAMBOO_NATURAL_300', 'BAMBOO_NATURAL_350') then '밤부팩(내추럴)'
      when m.material_code in ('EGGSHELL_300', 'EGGSHELL_350') then '에그쉘팩'
      when m.material_code in ('OLD_MILL_RECYCLE_300', 'OLD_MILL_RECYCLE_350') then '올드밀(리사이클)'
      when m.material_code in ('KRAFT_300', 'KRAFT_350') then '크라프트지'
      else null
    end as cafe24_material_value,
    s.display_name as size_label,
    q.quantity,
    po.display_name as print_label,
    fo.display_name as finish_label
  from active_version av
  join public.quote_price_matrix pm
    on pm.product_id = av.product_id
   and pm.price_version_id = av.price_version_id
  join public.quote_product_sizes s on s.id = pm.size_id
  join public.quote_materials m on m.id = pm.material_id
  join public.quote_product_quantities q on q.id = pm.quantity_option_id
  join public.quote_product_print_options po on po.id = pm.print_option_id
  join public.quote_product_finish_options fo on fo.id = pm.finish_option_id
),
prepared_rows as (
  select
    *,
    concat_ws('|', cafe24_material_value, size_label, quantity::text, print_label, finish_label) as cafe24_option_key
  from quote_rows
)
select
  count(*) as quote_price_row_count,
  count(distinct cafe24_option_key) as distinct_cafe24_option_key_count,
  count(*) filter (where cafe24_material_value is null) as unmapped_material_row_count,
  count(*) filter (where vat_inclusive_price is null or vat_inclusive_price <= 0) as invalid_price_row_count,
  min(vat_inclusive_price) as recommended_base_price,
  max(vat_inclusive_price) as maximum_quote_price,
  max(vat_inclusive_price) - min(vat_inclusive_price) as maximum_recommended_additional_amount
from prepared_rows;

-- Duplicate Cafe24 keys would make a variant price ambiguous and must be zero rows.
with active_version as (
  select p.id as product_id, pv.id as price_version_id
  from public.quote_products p
  join public.quote_price_versions pv on pv.product_id = p.id
  where p.product_code = 'ONE_TOUCH_BOX'
    and p.is_active = true
    and pv.status = 'active'
),
prepared_rows as (
  select concat_ws('|',
    case
      when m.material_code in ('AB_LIGHT_250', 'AB_LIGHT_270') then 'AB라이트'
      when m.material_code in ('BAMBOO_NATURAL_300', 'BAMBOO_NATURAL_350') then '밤부팩(내추럴)'
      when m.material_code in ('EGGSHELL_300', 'EGGSHELL_350') then '에그쉘팩'
      when m.material_code in ('OLD_MILL_RECYCLE_300', 'OLD_MILL_RECYCLE_350') then '올드밀(리사이클)'
      when m.material_code in ('KRAFT_300', 'KRAFT_350') then '크라프트지'
      else null
    end,
    s.display_name,
    q.quantity::text,
    po.display_name,
    fo.display_name
  ) as cafe24_option_key
  from active_version av
  join public.quote_price_matrix pm
    on pm.product_id = av.product_id
   and pm.price_version_id = av.price_version_id
  join public.quote_product_sizes s on s.id = pm.size_id
  join public.quote_materials m on m.id = pm.material_id
  join public.quote_product_quantities q on q.id = pm.quantity_option_id
  join public.quote_product_print_options po on po.id = pm.print_option_id
  join public.quote_product_finish_options fo on fo.id = pm.finish_option_id
)
select cafe24_option_key, count(*) as quote_rows
from prepared_rows
group by cafe24_option_key
having count(*) > 1
order by cafe24_option_key;
