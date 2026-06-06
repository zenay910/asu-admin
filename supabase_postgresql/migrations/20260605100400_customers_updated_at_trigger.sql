-- Wave 3 Phase A Task A5: updated_at trigger on customers (reuses set_updated_at)

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();
