-- Phase A Task A8: query-path indexes (additive)

create index if not exists appliances_status_idx
  on public.appliances (status);

create index if not exists appliances_lifecycle_state_idx
  on public.appliances (lifecycle_state);

create index if not exists parts_category_idx
  on public.parts (category);

create index if not exists part_compatibility_appliance_id_idx
  on public.part_compatibility (appliance_id);

create index if not exists part_compatibility_part_id_idx
  on public.part_compatibility (part_id);

create index if not exists appliance_images_appliance_id_idx
  on public.appliance_images (appliance_id);
