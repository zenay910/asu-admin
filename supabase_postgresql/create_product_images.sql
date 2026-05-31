create table public.product_images (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  product_id uuid null default gen_random_uuid (),
  photo_url text not null,
  constraint product_images_pkey primary key (id),
  constraint product_images_product_id_fkey foreign KEY (product_id) references products (id) on update CASCADE
) TABLESPACE pg_default;