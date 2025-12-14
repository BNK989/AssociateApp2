-- Migration: 20251214175100_guest_cleanup.sql

-- 1. Update Foreign Keys to Cascade Delete
-- Profiles
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey,
ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Game Players
ALTER TABLE public.game_players
DROP CONSTRAINT IF EXISTS game_players_user_id_fkey,
ADD CONSTRAINT game_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Messages
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_user_id_fkey,
ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Invites
ALTER TABLE public.invites
DROP CONSTRAINT IF EXISTS invites_receiver_id_fkey,
ADD CONSTRAINT invites_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Update Games Foreign Key to Set Null
-- If a player (creator/current turn) is deleted, we don't want to delete the whole game immediately,
-- but we might want to handle it. For now, Set Null prevents referential errors.
ALTER TABLE public.games
DROP CONSTRAINT IF EXISTS games_current_turn_user_id_fkey,
ADD CONSTRAINT games_current_turn_user_id_fkey FOREIGN KEY (current_turn_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Create Cleanup Function
-- Security Definer enables this function to access auth.users even when called by a limited role (or cron)
CREATE OR REPLACE FUNCTION delete_expired_guests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions -- Ensure access to auth schema
AS $$
BEGIN
  -- Delete users who are anonymous and created more than 24 hours ago
  -- The CASCADE Foreign Keys above will handle the cleanup of related public data
  DELETE FROM auth.users
  WHERE is_anonymous = true
  AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- 4. Schedule Cron Job (Requires pg_cron extension)
-- Ensure pg_cron is available
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule to run every hour
SELECT cron.schedule(
  'delete-guest-users',
  '0 * * * *', 
  $$SELECT delete_expired_guests()$$
);
