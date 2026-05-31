-- Phase B Task B1: RLS on appliances (policy-first, then enable)

drop policy if exists "Allow public read access to published appliances" on public.appliances;
drop policy if exists "Allow authenticated users full access to appliances" on public.appliances;
drop policy if exists "Allow service role full access to appliances" on public.appliances;

create policy "Allow public read access to published appliances"
on public.appliances
for select
using (status = 'Published');

create policy "Allow authenticated users full access to appliances"
on public.appliances
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to appliances"
on public.appliances
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.appliances enable row level security;
