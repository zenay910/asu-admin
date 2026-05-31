-- Phase A Task A5: part_compatibility table (additive)

create table if not exists public.part_compatibility (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  part_id uuid not null,
  appliance_id uuid not null,
  notes text null,
  constraint part_compatibility_pkey primary key (id),
  constraint part_compatibility_part_id_appliance_id_key unique (part_id, appliance_id),
  constraint part_compatibility_part_id_fkey
    foreign key (part_id) references public.parts (id) on delete cascade,
  constraint part_compatibility_appliance_id_fkey
    foreign key (appliance_id) references public.appliances (id) on delete cascade
) tablespace pg_default;
