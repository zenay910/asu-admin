-- Phase A Task A2: lifecycle & enum CHECK constraints on appliances

alter table public.appliances drop constraint if exists appliances_lifecycle_state_check;
alter table public.appliances add constraint appliances_lifecycle_state_check
  check (lifecycle_state in ('Intake', 'Refurbishment', 'Listed', 'Retired'));

alter table public.appliances drop constraint if exists appliances_condition_check;
alter table public.appliances add constraint appliances_condition_check
  check (condition is null or condition in ('New', 'Good', 'Fair', 'Poor'));

alter table public.appliances drop constraint if exists appliances_status_check;
alter table public.appliances add constraint appliances_status_check
  check (status is null or status in ('Draft', 'Published', 'Sold', 'Archived'));

alter table public.appliances drop constraint if exists appliances_configuration_check;
alter table public.appliances add constraint appliances_configuration_check
  check (
    configuration is null
    or configuration in (
      'Front Load', 'Top Load', 'Stacked Unit', 'Standard',
      'Slide-In', 'Glass Cooktop', 'Coil Cooktop'
    )
  );

alter table public.appliances drop constraint if exists appliances_unit_type_check;
alter table public.appliances add constraint appliances_unit_type_check
  check (unit_type is null or unit_type in ('Individual', 'Set'));

alter table public.appliances drop constraint if exists appliances_fuel_check;
alter table public.appliances add constraint appliances_fuel_check
  check (fuel is null or fuel in ('Electric', 'Gas', ''));

alter table public.appliances drop constraint if exists appliances_published_requires_listed_check;
alter table public.appliances add constraint appliances_published_requires_listed_check
  check (status is distinct from 'Published' or lifecycle_state = 'Listed');
