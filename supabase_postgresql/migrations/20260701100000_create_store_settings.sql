-- Google Merchant / store integration settings (server-only secrets via service role)

create table if not exists public.store_settings (
  setting_key text primary key,
  setting_value text,
  updated_at timestamptz not null default now()
);

drop policy if exists "store_settings_authenticated_all" on public.store_settings;
drop policy if exists "Allow service role full access to store_settings" on public.store_settings;

create policy "store_settings_authenticated_all"
on public.store_settings
for all
to authenticated
using (true)
with check (true);

create policy "Allow service role full access to store_settings"
on public.store_settings
for all
to service_role
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

alter table public.store_settings enable row level security;
