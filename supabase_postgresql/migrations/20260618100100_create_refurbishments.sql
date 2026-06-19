-- Active Bay Phase 1 Task 1.2–1.3: refurbishments table + bay integrity safeguards

create table if not exists public.refurbishments (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  appliance_id uuid not null,
  bay_id uuid null,
  status text not null default 'staging',
  source text null,
  cost numeric null,
  initial_symptoms text null,
  error_codes text null,
  work_needed text null,
  cleaning_status text null,
  test_mode_used text null,
  final_results text null,
  constraint refurbishments_pkey primary key (id),
  constraint refurbishments_appliance_id_key unique (appliance_id),
  constraint refurbishments_appliance_id_fkey
    foreign key (appliance_id) references public.appliances (id) on delete cascade,
  constraint refurbishments_bay_id_fkey
    foreign key (bay_id) references public.bays (id) on delete set null,
  constraint refurbishments_status_check
    check (status in ('staging', 'diagnostic', 'repair', 'testing', 'completed'))
) tablespace pg_default;

create unique index if not exists refurbishments_one_active_per_bay
  on public.refurbishments (bay_id)
  where bay_id is not null and status <> 'completed';

create or replace function public.check_bay_type_match() returns trigger as $$
declare
  bay_type text;
  appl_type text;
begin
  if new.bay_id is null then
    return new;
  end if;
  select machine_type into bay_type from public.bays where id = new.bay_id;
  select type into appl_type from public.appliances where id = new.appliance_id;
  if appl_type is distinct from bay_type then
    raise exception 'Bay type mismatch: appliance type % cannot occupy a % bay', appl_type, bay_type;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists check_bay_type_match on public.refurbishments;
create trigger check_bay_type_match
  before insert or update of bay_id, appliance_id on public.refurbishments
  for each row execute function public.check_bay_type_match();
