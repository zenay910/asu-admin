-- Wave 2 Phase A Task A8: invoice_line_items table (additive)

create table if not exists public.invoice_line_items (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  invoice_id uuid not null,
  kind text not null,
  part_id uuid null,
  appliance_id uuid null,
  description text null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  constraint invoice_line_items_pkey primary key (id),
  constraint invoice_line_items_invoice_id_fkey
    foreign key (invoice_id) references public.invoices (id) on delete cascade,
  constraint invoice_line_items_part_id_fkey
    foreign key (part_id) references public.parts (id) on delete set null,
  constraint invoice_line_items_appliance_id_fkey
    foreign key (appliance_id) references public.appliances (id) on delete set null,
  constraint invoice_line_items_kind_check
    check (kind in ('labor', 'part', 'appliance', 'fee'))
) tablespace pg_default;
