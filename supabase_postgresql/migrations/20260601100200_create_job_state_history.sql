-- Wave 2 Phase A Task A3: job_state_history audit table (additive)

create table if not exists public.job_state_history (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  job_id uuid not null,
  from_state text null,
  to_state text not null,
  changed_by uuid null,
  reason text null,
  constraint job_state_history_pkey primary key (id),
  constraint job_state_history_job_id_fkey
    foreign key (job_id) references public.jobs (id) on delete cascade
) tablespace pg_default;
