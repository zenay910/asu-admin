-- Wave 3 Phase A Task A2: FK constraints on jobs/invoices customer_id (additive)

alter table public.jobs drop constraint if exists jobs_customer_id_fkey;
alter table public.jobs add constraint jobs_customer_id_fkey
  foreign key (customer_id) references public.customers (id) on delete set null;

alter table public.invoices drop constraint if exists invoices_customer_id_fkey;
alter table public.invoices add constraint invoices_customer_id_fkey
  foreign key (customer_id) references public.customers (id) on delete restrict;
