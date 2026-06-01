-- Wave 2 Phase A Task A1: jobs table (additive; CHECK constraints in A2)

create table if not exists public.jobs (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  appliance_id uuid null,
  customer_id uuid null,
  job_class text not null,
  job_type text not null,
  state text not null default 'Open',
  summary text null,
  details jsonb null,
  labor_cost numeric not null default 0,
  constraint jobs_pkey primary key (id),
  constraint jobs_appliance_id_fkey
    foreign key (appliance_id) references public.appliances (id) on delete restrict
) tablespace pg_default;
