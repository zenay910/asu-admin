-- Wave 3 Phase A Task A3: appliances.customer_id column + FK (additive; not mirrored to products)

alter table public.appliances
  add column if not exists customer_id uuid null;

alter table public.appliances drop constraint if exists appliances_customer_id_fkey;
alter table public.appliances add constraint appliances_customer_id_fkey
  foreign key (customer_id) references public.customers (id) on delete set null;
