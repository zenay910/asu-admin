-- Active Bay Phase 1 Task 1.5: extend part_stock_movements (additive)

alter table public.part_stock_movements
  add column if not exists refurbishment_part_id uuid null;

alter table public.part_stock_movements
  drop constraint if exists part_stock_movements_refurbishment_part_id_fkey;
alter table public.part_stock_movements
  add constraint part_stock_movements_refurbishment_part_id_fkey
    foreign key (refurbishment_part_id)
    references public.refurbishment_parts (id) on delete set null;
