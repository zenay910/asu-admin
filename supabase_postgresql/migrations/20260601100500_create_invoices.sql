-- Wave 2 Phase A Task A6: invoice_number sequence + invoices table (CHECK constraints in A7)

create sequence if not exists public.invoice_number_seq;

create table if not exists public.invoices (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  invoice_number text not null default (
    'INV-' || lpad(nextval('public.invoice_number_seq'::regclass)::text, 6, '0')
  ),
  invoice_type text not null default 'job',
  job_id uuid null,
  appliance_id uuid null,
  customer_id uuid null,
  status text not null default 'Draft',
  subtotal numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  issued_at timestamp with time zone null,
  constraint invoices_pkey primary key (id),
  constraint invoices_invoice_number_key unique (invoice_number),
  constraint invoices_job_id_fkey
    foreign key (job_id) references public.jobs (id) on delete restrict,
  constraint invoices_appliance_id_fkey
    foreign key (appliance_id) references public.appliances (id) on delete restrict
) tablespace pg_default;
