create table if not exists public.appliance_set_members (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  set_appliance_id uuid not null,
  member_appliance_id uuid not null,
  sort_order smallint not null default 0,
  constraint appliance_set_members_pkey primary key (id),
  constraint appliance_set_members_set_appliance_id_fkey
    foreign key (set_appliance_id) references public.appliances (id) on delete cascade,
  constraint appliance_set_members_member_appliance_id_fkey
    foreign key (member_appliance_id) references public.appliances (id) on delete restrict,
  constraint appliance_set_members_unique unique (set_appliance_id, member_appliance_id)
) tablespace pg_default;

create index if not exists appliance_set_members_set_id_idx
  on public.appliance_set_members (set_appliance_id);

create index if not exists appliance_set_members_member_id_idx
  on public.appliance_set_members (member_appliance_id);
