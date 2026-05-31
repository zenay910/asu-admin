-- Phase 0 Task 0.6 — Step 1: Author RLS policies (enforcement NOT enabled yet)
-- Policy-first: policies must exist before ENABLE ROW LEVEL SECURITY.
-- Includes authenticated full-access policies required for asu-admin dashboard.

-- ===== PRODUCTS =====

drop policy if exists "Allow public read access to published products" on public.products;
drop policy if exists "Allow authenticated users full access to products" on public.products;
drop policy if exists "Allow service role full access to products" on public.products;

create policy "Allow public read access to published products"
on public.products
for select
using (status = 'Published');

create policy "Allow authenticated users full access to products"
on public.products
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to products"
on public.products
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

-- ===== PRODUCT_IMAGES =====

drop policy if exists "Allow public read access to product images" on public.product_images;
drop policy if exists "Allow authenticated users full access to product_images" on public.product_images;
drop policy if exists "Allow service role full access to product_images" on public.product_images;

create policy "Allow public read access to product images"
on public.product_images
for select
using (
  exists (
    select 1 from public.products
    where products.id = product_images.product_id
    and products.status = 'Published'
  )
);

create policy "Allow authenticated users full access to product_images"
on public.product_images
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to product_images"
on public.product_images
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');
