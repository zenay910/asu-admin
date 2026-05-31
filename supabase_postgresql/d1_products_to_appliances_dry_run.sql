-- Phase D Task D1: read-only products → appliances backfill dry-run (no writes)
-- Mapping logic mirrored in lib/migration/products-to-appliances.ts

with mapped as (
  select
    p.id,
    p.created_at,
    p.updated_at,
    coalesce(nullif(trim(p.title), ''), '') as title,
    coalesce(nullif(trim(p.brand), ''), '') as brand,
    p.price,
    coalesce(nullif(trim(p.model_number), ''), '') as model_number,
    p.type,
    p.configuration,
    p.dimensions,
    p.capacity,
    p.fuel,
    p.unit_type,
    p.color,
    case when p.features is not null then p.features::jsonb else null end as features,
    p.condition,
    p.description_long,
    p.age,
    p.status as status_raw,
    case when p.status = 'SOLD' then 'Sold' else p.status end as status,
    case
      when (case when p.status = 'SOLD' then 'Sold' else p.status end) = 'Published'
        then 'Listed'
      when (case when p.status = 'SOLD' then 'Sold' else p.status end) in ('Sold', 'Archived')
        then 'Retired'
      when (case when p.status = 'SOLD' then 'Sold' else p.status end) = 'Draft'
        then 'Intake'
      else 'Intake'
    end as lifecycle_state
  from public.products p
),
validated as (
  select
    m.*,
    (m.status is null or m.status in ('Draft', 'Published', 'Sold', 'Archived')) as chk_status,
    (m.condition is null or m.condition in ('New', 'Good', 'Fair', 'Poor')) as chk_condition,
    (m.configuration is null or m.configuration in (
      'Front Load', 'Top Load', 'Stacked Unit', 'Standard',
      'Slide-In', 'Glass Cooktop', 'Coil Cooktop'
    )) as chk_configuration,
    (m.unit_type is null or m.unit_type in ('Individual', 'Set')) as chk_unit_type,
    (m.fuel is null or m.fuel in ('Electric', 'Gas', '')) as chk_fuel,
    (m.lifecycle_state in ('Intake', 'Refurbishment', 'Listed', 'Retired')) as chk_lifecycle,
    (m.status is distinct from 'Published' or m.lifecycle_state = 'Listed') as chk_published_listed
  from mapped m
)
select
  count(*)::int as source_rows,
  count(*) filter (
    where chk_status
      and chk_condition
      and chk_configuration
      and chk_unit_type
      and chk_fuel
      and chk_lifecycle
      and chk_published_listed
  )::int as insert_safe_rows,
  count(*) filter (
    where not (
      chk_status
      and chk_condition
      and chk_configuration
      and chk_unit_type
      and chk_fuel
      and chk_lifecycle
      and chk_published_listed
    )
  )::int as a2_violations
from validated;

-- Per-row mapping (run separately or uncomment):
-- select id, title, status_raw, status, lifecycle_state from validated order by created_at;
