-- Wave 2 Phase A Task A5: part_stock_movements audit table (additive)

create table if not exists public.part_stock_movements (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  part_id uuid not null,
  job_part_id uuid null,
  delta int not null,
  quantity_after int not null,
  reason text null,
  changed_by uuid null,
  constraint part_stock_movements_pkey primary key (id),
  constraint part_stock_movements_part_id_fkey
    foreign key (part_id) references public.parts (id) on delete restrict,
  constraint part_stock_movements_job_part_id_fkey
    foreign key (job_part_id) references public.job_parts (id) on delete set null
) tablespace pg_default;
