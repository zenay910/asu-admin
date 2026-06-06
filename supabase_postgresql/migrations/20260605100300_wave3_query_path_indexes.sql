-- Wave 3 Phase A Task A4: query-path indexes for customer relationships (additive)

create index if not exists jobs_customer_id_idx
  on public.jobs (customer_id);

create index if not exists invoices_customer_id_idx
  on public.invoices (customer_id);

create index if not exists appliances_customer_id_idx
  on public.appliances (customer_id);

create index if not exists customers_full_name_lower_idx
  on public.customers (lower(full_name));

create index if not exists customers_email_lower_idx
  on public.customers (lower(email));
