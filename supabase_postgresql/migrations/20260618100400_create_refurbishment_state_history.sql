-- Active Bay Phase 1 Task 1.6: refurbishment_state_history audit table

create table if not exists public.refurbishment_state_history (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  refurbishment_id uuid not null,
  from_state text null,
  to_state text not null,
  changed_by uuid null,
  reason text null,
  constraint refurbishment_state_history_pkey primary key (id),
  constraint refurbishment_state_history_refurbishment_id_fkey
    foreign key (refurbishment_id) references public.refurbishments (id) on delete cascade
) tablespace pg_default;
