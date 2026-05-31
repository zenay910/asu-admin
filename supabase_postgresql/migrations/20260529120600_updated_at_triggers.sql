-- Phase A Task A7: shared updated_at trigger function + triggers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_appliances_updated_at on public.appliances;
create trigger set_appliances_updated_at
  before update on public.appliances
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_parts_updated_at on public.parts;
create trigger set_parts_updated_at
  before update on public.parts
  for each row
  execute function public.set_updated_at();
