-- Explicitly add tables to the realtime publication
-- Run this in the Supabase SQL Editor

begin;
  -- Remove if exists to be safe (optional, but good for reset)
  -- alter publication supabase_realtime drop table public.messages;
  -- alter publication supabase_realtime drop table public.games;

  -- Add tables to publication
  alter publication supabase_realtime add table public.messages;
  alter publication supabase_realtime add table public.games;
commit;
