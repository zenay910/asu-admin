-- Wave 3 Phase B Task B1: RLS on customers (internal-only; no anon)

drop policy if exists "Allow authenticated users full access to customers" on public.customers;
drop policy if exists "Allow service role full access to customers" on public.customers;

create policy "Allow authenticated users full access to customers"
on public.customers
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to customers"
on public.customers
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.customers enable row level security;
