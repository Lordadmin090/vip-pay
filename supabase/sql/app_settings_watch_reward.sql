-- Admin-configurable coins reward per completed video.
-- Run in Supabase SQL Editor after `app_settings.sql`.
alter table public.app_settings add column if not exists watch_reward_coins integer not null default 50;

comment on column public.app_settings.watch_reward_coins is 'Coins awarded when a user completes a video on Watch.';

