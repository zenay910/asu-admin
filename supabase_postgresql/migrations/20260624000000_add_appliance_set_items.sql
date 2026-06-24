-- Inventory set support: per-machine specs for unit_type = 'Set'

create table if not exists public.appliance_set_items (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  appliance_id uuid not null,
  sort_order smallint not null default 0,
  item_label text,
  brand text,
  model_number text,
  type text,
  configuration text,
  fuel text,
  capacity numeric,
  dimensions jsonb,
  age numeric,
  constraint appliance_set_items_pkey primary key (id),
  constraint appliance_set_items_appliance_id_fkey
    foreign key (appliance_id) references public.appliances (id) on delete cascade
) tablespace pg_default;

create index if not exists appliance_set_items_appliance_id_idx
  on public.appliance_set_items (appliance_id);

drop policy if exists "Allow authenticated users full access to appliance_set_items" on public.appliance_set_items;
drop policy if exists "Allow service role full access to appliance_set_items" on public.appliance_set_items;

create policy "Allow authenticated users full access to appliance_set_items"
on public.appliance_set_items
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to appliance_set_items"
on public.appliance_set_items
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.appliance_set_items enable row level security;
