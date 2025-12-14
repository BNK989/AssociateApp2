-- Supabase Schema Backup
-- Generated at: 2025-12-14
-- Scope: Public Schema Tables, Functions, Triggers, Policies

-- ==========================================
-- TABLES
-- ==========================================

-- Table: public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  username text,
  avatar_url text,
  settings jsonb DEFAULT '{"theme": "dark", "language": "en", "audio_volume": 1.0}'::jsonb,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()),
  is_admin boolean DEFAULT false
);

-- Table: public.games
CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  status text DEFAULT 'texting'::text CHECK (status = ANY (ARRAY['lobby'::text, 'texting'::text, 'active'::text, 'solving'::text, 'completed'::text])),
  mode text DEFAULT 'free'::text CHECK (mode = ANY (ARRAY['free'::text, 'turn_based'::text])),
  difficulty text DEFAULT 'normal'::text CHECK (difficulty = ANY (ARRAY['easy'::text, 'normal'::text, 'hard'::text])),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  topic text,
  team_pot integer DEFAULT 0,
  max_messages integer DEFAULT 100,
  message_count integer DEFAULT 0,
  current_turn_user_id uuid REFERENCES public.profiles(id),
  solving_started_at timestamptz
);

-- Table: public.game_players
CREATE TABLE IF NOT EXISTS public.game_players (
  game_id uuid REFERENCES public.games(id),
  user_id uuid REFERENCES public.profiles(id),
  joined_at timestamptz DEFAULT timezone('utc'::text, now()),
  score integer DEFAULT 0,
  is_ready boolean DEFAULT false,
  last_action_at timestamptz,
  PRIMARY KEY (game_id, user_id)
);

-- Table: public.messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games(id),
  user_id uuid REFERENCES public.profiles(id),
  content text,
  type text DEFAULT 'text'::text CHECK (type = ANY (ARRAY['text'::text, 'image'::text, 'system'::text, 'solve_proposal'::text])),
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  metadata jsonb,
  points_awarded integer,
  cipher_text text,
  ai_hint text
);

-- Table: public.invites
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES public.profiles(id),
  receiver_id uuid REFERENCES public.profiles(id),
  game_id uuid REFERENCES public.games(id),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])),
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- Table: public.notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  type text,
  content text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  metadata jsonb
);

-- Table: public.api_usage
CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  user_id uuid REFERENCES auth.users(id),
  game_id uuid REFERENCES public.games(id),
  endpoint text,
  ip_hash text
);

-- ==========================================
-- FUNCTIONS
-- ==========================================

CREATE OR REPLACE FUNCTION public.increment_score(row_id uuid, game_id_param uuid, amount integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE game_players
  SET score = score + amount
  WHERE user_id = row_id AND game_id = game_id_param;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_team_pot(game_id_param uuid, amount integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE games
  SET team_pot = team_pot + amount
  WHERE id = game_id_param;
END;
$function$;

CREATE OR REPLACE FUNCTION public.distribute_game_points(game_id_param uuid, winner_id uuid, winner_amount integer, author_id uuid DEFAULT NULL::uuid, author_amount integer DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Update Winner
  UPDATE game_players
  SET score = score + winner_amount
  WHERE user_id = winner_id AND game_id = game_id_param;

  -- Update Author (if exists)
  IF author_id IS NOT NULL AND author_amount > 0 THEN
    UPDATE game_players
    SET score = score + author_amount
    WHERE user_id = author_id AND game_id = game_id_param;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_game_status text;
  v_current_turn_user_id uuid;
  v_message_count int;
  v_next_player_id uuid;
  v_player_ids uuid[];
  v_current_player_index int;
BEGIN
  -- 0. Get Game Info
  SELECT status, current_turn_user_id INTO v_game_status, v_current_turn_user_id
  FROM public.games
  WHERE id = NEW.game_id;

  -- 1. Check if game is completed
  IF v_game_status = 'completed' THEN
    RAISE EXCEPTION 'Cannot send messages in a completed game';
  END IF;

  -- 2. Enforce Turn (if set)
  -- Allow if current_turn_user_id is NULL (e.g. start of game)
  -- ALSO ALLOW if this is the FIRST message (start random/start any)
  SELECT count(*) INTO v_message_count FROM messages WHERE game_id = NEW.game_id;
  
  -- If there are NO other messages, allow anyone to start.
  IF EXISTS (SELECT 1 FROM messages WHERE game_id = NEW.game_id AND id != NEW.id LIMIT 1) THEN
      IF v_current_turn_user_id IS NOT NULL AND v_current_turn_user_id != NEW.user_id THEN
        RAISE EXCEPTION 'It is not your turn!';
      END IF;
  END IF;

  -- 3. Calculate Next Turn
  -- Get all players ordered by joined_at
  SELECT ARRAY(
    SELECT user_id
    FROM public.game_players
    WHERE game_id = NEW.game_id
    ORDER BY joined_at ASC
  ) INTO v_player_ids;

  -- Find current player index (1-based)
  v_current_player_index := array_position(v_player_ids, NEW.user_id);
  
  IF v_current_player_index IS NULL THEN
     -- Sender not in players list? Should not happen if RLS works, but safe to ignore or fail.
     -- For now, we proceed only if we found the player.
     RETURN NEW;
  END IF;

  -- Calculate next index
  IF v_current_player_index = array_length(v_player_ids, 1) THEN
     v_next_player_id := v_player_ids[1];
  ELSE
     v_next_player_id := v_player_ids[v_current_player_index + 1];
  END IF;

  -- Update game with next player
  UPDATE public.games
  SET current_turn_user_id = v_next_player_id
  WHERE id = NEW.game_id;

  RETURN NEW;
END;
$function$;

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER on_message_insert
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION handle_new_message();

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- Table: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public select profiles" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT TO public WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE TO public USING (auth.uid() = id);

-- Table: games
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can delete all games" ON public.games FOR DELETE TO authenticated USING (( SELECT profiles.is_admin FROM profiles WHERE (profiles.id = auth.uid())) = true);
CREATE POLICY "Admins can select all games" ON public.games FOR SELECT TO authenticated USING (( SELECT profiles.is_admin FROM profiles WHERE (profiles.id = auth.uid())) = true);
CREATE POLICY "Allow authenticated update games" ON public.games FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can create games." ON public.games FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
CREATE POLICY "Games are viewable by everyone." ON public.games FOR SELECT TO public USING (true);

-- Table: game_players
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can join games." ON public.game_players FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "Game players are viewable by everyone." ON public.game_players FOR SELECT TO public USING (true);
CREATE POLICY "Users can update their own player status." ON public.game_players FOR UPDATE TO public USING (auth.uid() = user_id);

-- Table: messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can insert messages." ON public.messages FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "Messages are viewable by everyone." ON public.messages FOR SELECT TO public USING (true);
CREATE POLICY "Players can update messages (solve)." ON public.messages FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);

-- Table: invites
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Receivers can update status" ON public.invites FOR UPDATE TO public USING (auth.uid() = receiver_id);
CREATE POLICY "Receivers can view their invites" ON public.invites FOR SELECT TO public USING (auth.uid() = receiver_id);
CREATE POLICY "Senders can view invites they sent" ON public.invites FOR SELECT TO public USING (auth.uid() = sender_id);
CREATE POLICY "Users can create invites" ON public.invites FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);

-- Table: notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert notifications for others" ON public.notifications FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO public USING (auth.uid() = user_id);
