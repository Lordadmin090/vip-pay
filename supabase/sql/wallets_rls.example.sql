-- =============================================================================
-- Fix "Reward not saved" / wallet updates returning 0 rows (RLS blocking UPDATE)
-- Run in: Supabase Dashboard → SQL → New query → Paste → Run
-- =============================================================================
-- Prerequisites: table `public.wallets` with column `user_id` (uuid) matching auth.users.id

alter table public.wallets enable row level security;

-- Replace policies if you re-run this script
drop policy if exists "wallets_select_own" on public.wallets;
drop policy if exists "wallets_insert_own" on public.wallets;
drop policy if exists "wallets_update_own" on public.wallets;

-- Read own row (refresh / wallet screen)
create policy "wallets_select_own"
  on public.wallets for select
  using (auth.uid() = user_id);

-- First wallet row when user has no row yet
create policy "wallets_insert_own"
  on public.wallets for insert
  with check (auth.uid() = user_id);

-- Required for watch rewards, shop, SP saves (client updates balance columns)
create policy "wallets_update_own"
  on public.wallets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
