-- Phase 0 Task 0.6 — Step 3: Enable RLS (run only after policies verified)

alter table public.products enable row level security;
alter table public.product_images enable row level security;
