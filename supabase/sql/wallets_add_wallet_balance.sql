-- Add shop wallet balance to `public.wallets`.
-- This is separate from withdrawable USD-ready (`wallet_usd`).
-- Run in Supabase Dashboard → SQL editor.
alter table public.wallets add column if not exists wallet_balance numeric(18,4) not null default 0;

comment on column public.wallets.wallet_balance is 'USD deposited for shop / scroll-point purchases only (not withdrawable).';
comment on column public.wallets.wallet_usd is 'USD ready — converted coins → USD; withdrawable (not for shop).';

