-- Wave 2 Phase B Task B2: RLS on job_parts + part_stock_movements (internal-only; no anon)

-- ===== JOB_PARTS =====

drop policy if exists "Allow authenticated users full access to job_parts" on public.job_parts;
drop policy if exists "Allow service role full access to job_parts" on public.job_parts;

create policy "Allow authenticated users full access to job_parts"
on public.job_parts
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to job_parts"
on public.job_parts
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.job_parts enable row level security;

-- ===== PART_STOCK_MOVEMENTS =====

drop policy if exists "Allow authenticated users full access to part_stock_movements" on public.part_stock_movements;
drop policy if exists "Allow service role full access to part_stock_movements" on public.part_stock_movements;

create policy "Allow authenticated users full access to part_stock_movements"
on public.part_stock_movements
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to part_stock_movements"
on public.part_stock_movements
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.part_stock_movements enable row level security;
