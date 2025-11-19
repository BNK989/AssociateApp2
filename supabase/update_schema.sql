-- Add column for voting mechanism
alter table public.games 
add column solving_proposal_created_at timestamp with time zone;

-- Ensure Realtime listens to this new column (it should automatically since we added the table, but good to know)
