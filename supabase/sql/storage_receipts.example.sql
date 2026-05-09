-- Storage bucket + policies for receipt uploads

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload into their own folder: /<uid>/...
drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow anyone to read receipts if bucket is public (or keep as authenticated-only if you set public=false)
drop policy if exists "receipts_select_all" on storage.objects;
create policy "receipts_select_all"
  on storage.objects for select
  using (bucket_id = 'receipts');

