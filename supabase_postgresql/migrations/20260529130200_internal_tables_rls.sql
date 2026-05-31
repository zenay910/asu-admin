-- Phase B Task B3: RLS on internal-only tables (no anon access)

-- ===== PARTS =====

drop policy if exists "Allow authenticated users full access to parts" on public.parts;
drop policy if exists "Allow service role full access to parts" on public.parts;

create policy "Allow authenticated users full access to parts"
on public.parts
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to parts"
on public.parts
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.parts enable row level security;

-- ===== PART_COMPATIBILITY =====

drop policy if exists "Allow authenticated users full access to part_compatibility" on public.part_compatibility;
drop policy if exists "Allow service role full access to part_compatibility" on public.part_compatibility;

create policy "Allow authenticated users full access to part_compatibility"
on public.part_compatibility
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to part_compatibility"
on public.part_compatibility
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.part_compatibility enable row level security;

-- ===== APPLIANCE_STATE_HISTORY =====

drop policy if exists "Allow authenticated users full access to appliance_state_history" on public.appliance_state_history;
drop policy if exists "Allow service role full access to appliance_state_history" on public.appliance_state_history;

create policy "Allow authenticated users full access to appliance_state_history"
on public.appliance_state_history
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to appliance_state_history"
on public.appliance_state_history
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.appliance_state_history enable row level security;
