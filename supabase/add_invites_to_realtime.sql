-- Add invites and game_players to the realtime publication
alter publication supabase_realtime add table public.invites;
alter publication supabase_realtime add table public.game_players;
