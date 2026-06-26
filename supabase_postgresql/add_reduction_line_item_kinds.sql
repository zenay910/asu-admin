-- Extend invoice_line_items.kind to support reduction line types.
-- Idempotent: safe to re-run.

alter table public.invoice_line_items
  drop constraint if exists invoice_line_items_kind_check;

alter table public.invoice_line_items
  add constraint invoice_line_items_kind_check
    check (kind in ('labor', 'part', 'appliance', 'fee', 'discount', 'trade_in'));
