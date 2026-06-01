-- Wave 2 Phase B Task B3: RLS on invoices + invoice_line_items (internal-only; no anon)

-- ===== INVOICES =====

drop policy if exists "Allow authenticated users full access to invoices" on public.invoices;
drop policy if exists "Allow service role full access to invoices" on public.invoices;

create policy "Allow authenticated users full access to invoices"
on public.invoices
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to invoices"
on public.invoices
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.invoices enable row level security;

-- ===== INVOICE_LINE_ITEMS =====

drop policy if exists "Allow authenticated users full access to invoice_line_items" on public.invoice_line_items;
drop policy if exists "Allow service role full access to invoice_line_items" on public.invoice_line_items;

create policy "Allow authenticated users full access to invoice_line_items"
on public.invoice_line_items
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to invoice_line_items"
on public.invoice_line_items
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.invoice_line_items enable row level security;
