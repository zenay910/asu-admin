-- Wave 2 Phase B Task B1: RLS on jobs + job_state_history (internal-only; no anon)

-- ===== JOBS =====

drop policy if exists "Allow authenticated users full access to jobs" on public.jobs;
drop policy if exists "Allow service role full access to jobs" on public.jobs;

create policy "Allow authenticated users full access to jobs"
on public.jobs
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to jobs"
on public.jobs
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.jobs enable row level security;

-- ===== JOB_STATE_HISTORY =====

drop policy if exists "Allow authenticated users full access to job_state_history" on public.job_state_history;
drop policy if exists "Allow service role full access to job_state_history" on public.job_state_history;

create policy "Allow authenticated users full access to job_state_history"
on public.job_state_history
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to job_state_history"
on public.job_state_history
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.job_state_history enable row level security;
