-- Create the avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set up security policies for the avatars bucket

-- Allow public access to view avatars
create policy "Avatar Public Access"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Allow authenticated users to upload their own avatars
create policy "Avatar Upload"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'avatars' );

-- Allow users to update their own avatars
create policy "Avatar Update"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'avatars' and auth.uid() = owner );

-- Allow users to delete their own avatars
create policy "Avatar Delete"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'avatars' and auth.uid() = owner );
