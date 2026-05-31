-- Phase D Task D2: idempotent products → appliances + product_images → appliance_images
-- Mapping rules: lib/migration/products-to-appliances.ts · D1 dry-run approved 2026-05-29

insert into public.appliances (
  id,
  created_at,
  updated_at,
  title,
  brand,
  price,
  model_number,
  type,
  configuration,
  dimensions,
  capacity,
  fuel,
  unit_type,
  color,
  features,
  condition,
  lifecycle_state,
  status,
  description_long,
  age
)
select
  p.id,
  p.created_at,
  p.updated_at,
  coalesce(nullif(trim(p.title), ''), ''),
  coalesce(nullif(trim(p.brand), ''), ''),
  p.price,
  coalesce(nullif(trim(p.model_number), ''), ''),
  p.type,
  p.configuration,
  p.dimensions,
  p.capacity,
  p.fuel,
  p.unit_type,
  p.color,
  case when p.features is not null then p.features::jsonb else null end,
  p.condition,
  case
    when (case when p.status = 'SOLD' then 'Sold' else p.status end) = 'Published'
      then 'Listed'
    when (case when p.status = 'SOLD' then 'Sold' else p.status end) in ('Sold', 'Archived')
      then 'Retired'
    when (case when p.status = 'SOLD' then 'Sold' else p.status end) = 'Draft'
      then 'Intake'
    else 'Intake'
  end,
  case when p.status = 'SOLD' then 'Sold' else p.status end,
  p.description_long,
  p.age
from public.products p
on conflict (id) do nothing;

insert into public.appliance_images (
  id,
  created_at,
  appliance_id,
  photo_url,
  sort_order
)
select
  pi.id,
  pi.created_at,
  pi.product_id,
  pi.photo_url,
  (row_number() over (partition by pi.product_id order by pi.created_at, pi.id) - 1)::int
from public.product_images pi
where pi.product_id is not null
  and exists (
    select 1 from public.appliances a where a.id = pi.product_id
  )
on conflict (id) do nothing;
