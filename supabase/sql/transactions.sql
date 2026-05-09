-- Activity ledger for watch rewards, conversions, withdrawals, SP spend, etc.
-- This table is what the app reads for the History "Earnings" and "Withdrawals" tabs.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  balance_type text not null, -- wallet_usd | coin_balance | scroll_points | gas_fee_balance
  direction text not null, -- credit | debit
  amount numeric(18,4) not null default 0,
  sp_delta integer not null default 0,
  reference_type text null,
  reference_id text null,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);

