-- Wave 2 Phase A Task A10: query-path indexes (additive)

create index if not exists jobs_appliance_id_idx
  on public.jobs (appliance_id);

create index if not exists jobs_state_idx
  on public.jobs (state);

create index if not exists jobs_job_class_idx
  on public.jobs (job_class);

create index if not exists job_parts_job_id_idx
  on public.job_parts (job_id);

create index if not exists job_parts_part_id_idx
  on public.job_parts (part_id);

create index if not exists part_stock_movements_part_id_idx
  on public.part_stock_movements (part_id);

create index if not exists invoices_job_id_idx
  on public.invoices (job_id);

create index if not exists invoices_appliance_id_idx
  on public.invoices (appliance_id);

create index if not exists invoices_invoice_type_idx
  on public.invoices (invoice_type);

create index if not exists invoices_status_idx
  on public.invoices (status);

create index if not exists invoice_line_items_invoice_id_idx
  on public.invoice_line_items (invoice_id);
