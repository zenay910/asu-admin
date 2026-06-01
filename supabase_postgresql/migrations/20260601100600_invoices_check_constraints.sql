-- Wave 2 Phase A Task A7: CHECK constraints on invoices

-- Remove pre-constraint smoke rows (A6 inserts with invoice_type=job and no job_id)
delete from public.invoices
where invoice_type = 'job' and job_id is null;

alter table public.invoices drop constraint if exists invoices_invoice_type_check;
alter table public.invoices add constraint invoices_invoice_type_check
  check (invoice_type in ('job', 'appliance_sale', 'retail'));

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('Draft', 'Issued', 'Paid', 'Void'));

alter table public.invoices drop constraint if exists invoices_subtotal_check;
alter table public.invoices add constraint invoices_subtotal_check
  check (subtotal >= 0);

alter table public.invoices drop constraint if exists invoices_tax_check;
alter table public.invoices add constraint invoices_tax_check
  check (tax >= 0);

alter table public.invoices drop constraint if exists invoices_total_check;
alter table public.invoices add constraint invoices_total_check
  check (total >= 0);

alter table public.invoices drop constraint if exists invoices_source_consistency_check;
alter table public.invoices add constraint invoices_source_consistency_check
  check (
    (invoice_type = 'job' and job_id is not null)
    or (invoice_type = 'appliance_sale' and appliance_id is not null)
    or (invoice_type = 'retail' and job_id is null)
  );
