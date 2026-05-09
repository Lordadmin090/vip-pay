-- Admin-adjustable platform settings (coins ↔ USD). Run in Supabase SQL Editor.
-- Your admin panel should UPDATE public.app_settings SET coins_per_usd = … WHERE id = 1;

create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  coins_per_usd numeric not null default 1000,
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is 'Singleton row (id=1). coins_per_usd = how many coins equal US $1.';

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_authenticated" on public.app_settings;

create policy "app_settings_select_authenticated"
  on public.app_settings for select
  to authenticated
  using (true);

insert into public.app_settings (id, coins_per_usd)
values (1, 1000)
on conflict (id) do nothing;
