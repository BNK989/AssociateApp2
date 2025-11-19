-- Drop existing foreign keys
ALTER TABLE public.messages DROP CONSTRAINT messages_user_id_fkey;
ALTER TABLE public.game_players DROP CONSTRAINT game_players_user_id_fkey;
ALTER TABLE public.games DROP CONSTRAINT games_current_turn_user_id_fkey;

-- Add new foreign keys referencing public.profiles
ALTER TABLE public.messages
ADD CONSTRAINT messages_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.game_players
ADD CONSTRAINT game_players_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.games
ADD CONSTRAINT games_current_turn_user_id_fkey
FOREIGN KEY (current_turn_user_id) REFERENCES public.profiles(id);
