-- Active Bay Phase 1 Task 1.7: updated_at trigger + indexes

drop trigger if exists set_refurbishments_updated_at on public.refurbishments;
create trigger set_refurbishments_updated_at
  before update on public.refurbishments
  for each row execute function public.set_updated_at();

create index if not exists refurbishments_status_idx on public.refurbishments (status);
create index if not exists refurbishments_bay_id_idx on public.refurbishments (bay_id);
create index if not exists refurbishments_appliance_id_idx on public.refurbishments (appliance_id);
create index if not exists refurbishment_parts_refurbishment_id_idx
  on public.refurbishment_parts (refurbishment_id);
create index if not exists refurbishment_parts_part_id_idx
  on public.refurbishment_parts (part_id);
create index if not exists part_stock_movements_refurbishment_part_id_idx
  on public.part_stock_movements (refurbishment_part_id);
