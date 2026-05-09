-- Add shop funding balance (separate from withdrawable USD ready).
-- Run in Supabase SQL Editor after the main VidPey schema.
alter table public.users add column if not exists wallet_balance numeric(18,4) not null default 0;

comment on column public.users.wallet_balance is 'USD deposited for shop / scroll-point purchases only (not withdrawable).';
comment on column public.users.usd_balance is 'USD ready — converted coins → USD; withdrawable (not for shop).';
