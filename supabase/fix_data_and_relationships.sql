-- 1. Backfill missing profiles from auth.users
-- This ensures all valid users have a profile
INSERT INTO public.profiles (id, username, avatar_url)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', 'Unknown User'), raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- 2. Delete orphaned data
-- Removes messages/games linked to users that don't exist in profiles (e.g. old test data)
DELETE FROM public.messages WHERE user_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.game_players WHERE user_id NOT IN (SELECT id FROM public.profiles);
-- For games, we set the turn to NULL if the user is gone, or delete the game? 
-- Safest is to just let the FK fail if we don't delete, so let's set to NULL or delete.
-- Let's just delete games owned by ghosts to be clean.
DELETE FROM public.games WHERE current_turn_user_id IS NOT NULL AND current_turn_user_id NOT IN (SELECT id FROM public.profiles);

-- 3. Now safe to update Foreign Keys
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE public.game_players DROP CONSTRAINT IF EXISTS game_players_user_id_fkey;
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_current_turn_user_id_fkey;

ALTER TABLE public.messages
ADD CONSTRAINT messages_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.game_players
ADD CONSTRAINT game_players_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.games
ADD CONSTRAINT games_current_turn_user_id_fkey
FOREIGN KEY (current_turn_user_id) REFERENCES public.profiles(id);
