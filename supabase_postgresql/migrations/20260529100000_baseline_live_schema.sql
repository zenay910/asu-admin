-- Baseline migration: reconciled live schema snapshot (2026-05-29)
--
-- Purpose: first tracked migration establishing source-of-record for the shared
-- Supabase database used by asu-admin and asu-frontend.
--
-- Live state at capture time:
--   public.products       — 29 rows, RLS disabled, no CHECK constraints
--   public.product_images — 84 rows, RLS disabled, no CHECK constraints
--
-- IMPORTANT: Do NOT apply this migration to the production database — the live
-- tables already exist. This file documents the authoritative schema for new
-- environments and future tracked migrations only.

-- ===== PRODUCTS =====

create table if not exists public.products (
  created_at timestamp with time zone not null default now(),
  title text not null default ''::text,
  brand text not null default ''::text,
  price numeric not null,
  model_number text not null default ''::text,
  type text null,
  configuration text null,
  dimensions jsonb null,
  capacity numeric null,
  fuel text null,
  unit_type text null,
  color text null,
  features json null,
  condition text null,
  status text null,
  description_long text null,
  updated_at timestamp with time zone null default now(),
  id uuid not null default gen_random_uuid(),
  age numeric null,
  constraint products_pkey primary key (id),
  constraint products_id_key unique (id)
) tablespace pg_default;

-- Backfill column for environments created from older DDL missing age.
alter table public.products
  add column if not exists age numeric;

-- ===== PRODUCT_IMAGES =====

create table if not exists public.product_images (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  product_id uuid null default gen_random_uuid(),
  photo_url text not null,
  constraint product_images_pkey primary key (id),
  constraint product_images_product_id_fkey
    foreign key (product_id) references products (id) on update cascade
) tablespace pg_default;
