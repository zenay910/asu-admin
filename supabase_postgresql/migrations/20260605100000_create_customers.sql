-- Wave 3 Phase A Task A1: customers table (additive; FKs/indexes/trigger in A2–A5)

create table if not exists public.customers (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  full_name text not null,
  email text null,
  phone text null,
  address jsonb null,
  notes text null,
  constraint customers_pkey primary key (id)
) tablespace pg_default;
