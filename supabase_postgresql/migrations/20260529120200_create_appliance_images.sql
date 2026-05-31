-- Phase A Task A3: appliance_images table (additive)

create table if not exists public.appliance_images (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  appliance_id uuid not null,
  photo_url text not null,
  sort_order int not null default 0,
  constraint appliance_images_pkey primary key (id),
  constraint appliance_images_appliance_id_fkey
    foreign key (appliance_id) references public.appliances (id) on delete cascade
) tablespace pg_default;
