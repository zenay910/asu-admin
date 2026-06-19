-- Active Bay Phase 1 Task 1.8: RLS on refurbishment tables (internal-only; no anon)

-- ===== BAYS =====

drop policy if exists "Allow authenticated users full access to bays" on public.bays;
drop policy if exists "Allow service role full access to bays" on public.bays;

create policy "Allow authenticated users full access to bays"
on public.bays
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to bays"
on public.bays
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.bays enable row level security;

-- ===== REFURBISHMENTS =====

drop policy if exists "Allow authenticated users full access to refurbishments" on public.refurbishments;
drop policy if exists "Allow service role full access to refurbishments" on public.refurbishments;

create policy "Allow authenticated users full access to refurbishments"
on public.refurbishments
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to refurbishments"
on public.refurbishments
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.refurbishments enable row level security;

-- ===== REFURBISHMENT_PARTS =====

drop policy if exists "Allow authenticated users full access to refurbishment_parts" on public.refurbishment_parts;
drop policy if exists "Allow service role full access to refurbishment_parts" on public.refurbishment_parts;

create policy "Allow authenticated users full access to refurbishment_parts"
on public.refurbishment_parts
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to refurbishment_parts"
on public.refurbishment_parts
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.refurbishment_parts enable row level security;

-- ===== REFURBISHMENT_STATE_HISTORY =====

drop policy if exists "Allow authenticated users full access to refurbishment_state_history" on public.refurbishment_state_history;
drop policy if exists "Allow service role full access to refurbishment_state_history" on public.refurbishment_state_history;

create policy "Allow authenticated users full access to refurbishment_state_history"
on public.refurbishment_state_history
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to refurbishment_state_history"
on public.refurbishment_state_history
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.refurbishment_state_history enable row level security;
