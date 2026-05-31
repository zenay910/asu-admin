create table if not exists public.appliance_state_history (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  appliance_id uuid not null,
  from_state text null,
  to_state text not null,
  changed_by uuid null,
  reason text null,
  constraint appliance_state_history_pkey primary key (id),
  constraint appliance_state_history_appliance_id_fkey
    foreign key (appliance_id) references public.appliances (id) on delete cascade
) tablespace pg_default;
