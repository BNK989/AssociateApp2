-- Create feedback table
create table public.feedback (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  name text null,
  email text null,
  message text not null,
  feedback_type text not null check (feedback_type in ('bug', 'feature_request', 'general', 'other')),
  status text not null default 'new',
  user_id uuid null references auth.users (id) on delete set null,
  constraint feedback_pkey primary key (id)
);

-- Enable RLS
alter table public.feedback enable row level security;

-- Policies
create policy "Allow public insert to feedback"
  on public.feedback
  for insert
  with check (true);

create policy "Allow admins to view feedback"
  on public.feedback
  for select
  using (
    -- Assuming we have an admin check/claim or just restricting to service role for now.
    -- For now, let's restrict to service_role only or authenticated users if we had an admin flag.
    -- Since we don't have a robust admin system yet, we'll leave it restricted (default deny for select).
    false 
  );
