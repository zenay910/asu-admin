-- Active Bay Phase 1 Task 1.1: bays reference table (seeded)

create table if not exists public.bays (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  name text not null,
  machine_type text not null,
  position int not null,
  constraint bays_pkey primary key (id),
  constraint bays_machine_type_check check (machine_type in ('Dryer', 'Washer')),
  constraint bays_machine_type_position_key unique (machine_type, position)
) tablespace pg_default;

insert into public.bays (name, machine_type, position)
values
  ('Dryer Bay 1', 'Dryer', 1),
  ('Dryer Bay 2', 'Dryer', 2),
  ('Dryer Bay 3', 'Dryer', 3),
  ('Washer Bay 1', 'Washer', 1),
  ('Washer Bay 2', 'Washer', 2),
  ('Washer Bay 3', 'Washer', 3)
on conflict (machine_type, position) do nothing;
