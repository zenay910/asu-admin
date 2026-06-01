-- Wave 2 Phase A Task A2: CHECK constraints on jobs

alter table public.jobs drop constraint if exists jobs_job_class_check;
alter table public.jobs add constraint jobs_job_class_check
  check (job_class in ('Internal', 'Customer'));

alter table public.jobs drop constraint if exists jobs_state_check;
alter table public.jobs add constraint jobs_state_check
  check (state in ('Open', 'In Progress', 'Completed', 'Closed'));

alter table public.jobs drop constraint if exists jobs_job_type_check;
alter table public.jobs add constraint jobs_job_type_check
  check (
    job_type in (
      'Intake', 'Diagnostic', 'Repair', 'Cleaning',
      'Delivery', 'Installation', 'Maintenance', 'Warranty'
    )
  );

alter table public.jobs drop constraint if exists jobs_labor_cost_check;
alter table public.jobs add constraint jobs_labor_cost_check
  check (labor_cost >= 0);

alter table public.jobs drop constraint if exists jobs_internal_requires_appliance_check;
alter table public.jobs add constraint jobs_internal_requires_appliance_check
  check (job_class <> 'Internal' or appliance_id is not null);
