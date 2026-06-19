-- Active Bay Phase 1 Task 1.4: refurbishment_parts table

create table if not exists public.refurbishment_parts (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  refurbishment_id uuid not null,
  part_id uuid not null,
  quantity int not null,
  unit_price numeric not null,
  constraint refurbishment_parts_pkey primary key (id),
  constraint refurbishment_parts_refurbishment_id_fkey
    foreign key (refurbishment_id) references public.refurbishments (id) on delete cascade,
  constraint refurbishment_parts_part_id_fkey
    foreign key (part_id) references public.parts (id) on delete restrict,
  constraint refurbishment_parts_quantity_check check (quantity > 0)
) tablespace pg_default;
