-- Allow users to submit deposit receipts (purchases) and view their own.
-- Admin review should be done using service role / dashboard.

alter table public.purchases enable row level security;

drop policy if exists "purchases_select_own" on public.purchases;
drop policy if exists "purchases_insert_own" on public.purchases;

create policy "purchases_select_own"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "purchases_insert_own"
  on public.purchases for insert
  with check (auth.uid() = user_id);

