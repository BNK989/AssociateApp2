-- Fix Foreign Key Relationships for PostgREST
-- We need to ensure game_players references profiles so that the frontend can join them.
-- Chain: auth.users (delete) -> profiles (cascade) -> game_players (cascade)

-- 1. Game Players: Point back to profiles, not auth.users directly
ALTER TABLE public.game_players
DROP CONSTRAINT IF EXISTS game_players_user_id_fkey;

-- Add constraint referencing profiles with CASCADE
ALTER TABLE public.game_players
ADD CONSTRAINT game_players_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 2. Messages: Point back to profiles? Or same issue?
-- Frontend likely queries messages(profiles(username)).
-- Check if messages need the same fix.
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_user_id_fkey;

ALTER TABLE public.messages
ADD CONSTRAINT messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 3. Invites: Point back to profiles
ALTER TABLE public.invites
DROP CONSTRAINT IF EXISTS invites_receiver_id_fkey;

ALTER TABLE public.invites
ADD CONSTRAINT invites_receiver_id_fkey 
FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Note: profiles.id -> auth.users.id is already set to CASCADE in the previous migration, so the chain is complete.
