-- Allow authenticated users to read active packages (shop).
alter table public.packages enable row level security;

drop policy if exists "packages_select_active" on public.packages;

create policy "packages_select_active"
  on public.packages for select
  to authenticated
  using (status = 'active');
