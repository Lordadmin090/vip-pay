-- Wallet activity log for History, Wallet feed, Notifications, receipts.
-- Run in Supabase SQL Editor after wallets exist.

create table if not exists public.wallet_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  title text not null,
  subtitle text,
  amount_coins numeric,
  amount_usd numeric,
  amount_sp numeric,
  status text not null default 'completed',
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_activities_user_created_idx
  on public.wallet_activities (user_id, created_at desc);

alter table public.wallet_activities enable row level security;

create policy "wallet_activities_select_own"
  on public.wallet_activities for select
  using (auth.uid() = user_id);

create policy "wallet_activities_insert_own"
  on public.wallet_activities for insert
  with check (auth.uid() = user_id);
