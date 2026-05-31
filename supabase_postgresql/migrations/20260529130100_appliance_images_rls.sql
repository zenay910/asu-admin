-- Phase B Task B2: RLS on appliance_images (policy-first, then enable)

drop policy if exists "Allow public read access to appliance images" on public.appliance_images;
drop policy if exists "Allow authenticated users full access to appliance_images" on public.appliance_images;
drop policy if exists "Allow service role full access to appliance_images" on public.appliance_images;

create policy "Allow public read access to appliance images"
on public.appliance_images
for select
using (
  exists (
    select 1 from public.appliances
    where appliances.id = appliance_images.appliance_id
    and appliances.status = 'Published'
  )
);

create policy "Allow authenticated users full access to appliance_images"
on public.appliance_images
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to appliance_images"
on public.appliance_images
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.appliance_images enable row level security;
