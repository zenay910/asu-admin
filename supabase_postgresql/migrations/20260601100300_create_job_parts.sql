-- Wave 2 Phase A Task A4: job_parts table (additive)

create table if not exists public.job_parts (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  job_id uuid not null,
  part_id uuid not null,
  quantity int not null,
  unit_price numeric not null,
  constraint job_parts_pkey primary key (id),
  constraint job_parts_job_id_fkey
    foreign key (job_id) references public.jobs (id) on delete cascade,
  constraint job_parts_part_id_fkey
    foreign key (part_id) references public.parts (id) on delete restrict,
  constraint job_parts_quantity_check check (quantity > 0)
) tablespace pg_default;
