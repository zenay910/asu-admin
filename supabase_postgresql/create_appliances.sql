create table if not exists public.appliances (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  title text not null default ''::text,
  brand text not null default ''::text,
  price numeric not null,
  model_number text not null default ''::text,
  type text null,
  configuration text null,
  dimensions jsonb null,
  capacity numeric null,
  fuel text null,
  unit_type text null,
  color text null,
  features jsonb null,
  condition text null,
  lifecycle_state text not null default 'Intake',
  status text null,
  description_long text null,
  age numeric null,
  constraint appliances_pkey primary key (id),
  constraint appliances_id_key unique (id),
  constraint appliances_lifecycle_state_check
    check (lifecycle_state in ('Intake', 'Refurbishment', 'Listed', 'Retired')),
  constraint appliances_condition_check
    check (condition is null or condition in ('New', 'Good', 'Fair', 'Poor')),
  constraint appliances_status_check
    check (status is null or status in ('Draft', 'Published', 'Sold', 'Archived')),
  constraint appliances_configuration_check
    check (
      configuration is null
      or configuration in (
        'Front Load', 'Top Load', 'Stacked Unit', 'Standard',
        'Slide-In', 'Glass Cooktop', 'Coil Cooktop'
      )
    ),
  constraint appliances_unit_type_check
    check (unit_type is null or unit_type in ('Individual', 'Set')),
  constraint appliances_fuel_check
    check (fuel is null or fuel in ('Electric', 'Gas', '')),
  constraint appliances_published_requires_listed_check
    check (status is distinct from 'Published' or lifecycle_state = 'Listed')
) tablespace pg_default;
