-- Stores device push tokens per user so backend/admin actions can send notifications.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  device_os text not null default 'unknown',
  device_id text null,
  created_at timestamptz not null default now()
);

create unique index if not exists push_tokens_user_token_uq
  on public.push_tokens (user_id, expo_push_token);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_tokens;
drop policy if exists "push_tokens_upsert_own" on public.push_tokens;
drop policy if exists "push_tokens_insert_own" on public.push_tokens;
drop policy if exists "push_tokens_update_own" on public.push_tokens;
drop policy if exists "push_tokens_delete_own" on public.push_tokens;

create policy "push_tokens_select_own"
  on public.push_tokens for select
  using (auth.uid() = user_id);

-- NOTE: client-side `upsert(...)` needs BOTH insert + update policies when a conflict occurs.
create policy "push_tokens_insert_own"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

create policy "push_tokens_update_own"
  on public.push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: allow users to revoke old tokens from their account
create policy "push_tokens_delete_own"
  on public.push_tokens for delete
  using (auth.uid() = user_id);

