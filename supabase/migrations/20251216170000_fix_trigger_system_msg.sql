CREATE OR REPLACE FUNCTION handle_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_game_status text;
  v_current_turn_user_id uuid;
  v_next_player_id uuid;
  v_player_ids uuid[];
  v_current_player_index int;
  v_message_count int;
  v_message_type text;
BEGIN
  -- 0. Bypass for System Messages
  -- We assume system messages are trusted and handled by the RPC that inserts them (e.g. leave_game)
  -- Also bypass for 'guess' or solved messages if needed? 
  -- Currently schema has type default 'text'.
  -- Check column existence safely? No, we know column exists from recent migration.
  -- But to be safe in PL/pgSQL with old rows... NEW.type should be available.
  
  IF NEW.type = 'system' THEN
      RETURN NEW;
  END IF;

  -- Get game info
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
    AND has_left = false -- CHANGED: Filter out left players in rotation (Fix consistency)
    ORDER BY joined_at ASC
  ) INTO v_player_ids;

  -- Find current player index (1-based)
  v_current_player_index := array_position(v_player_ids, NEW.user_id);
  
  IF v_current_player_index IS NULL THEN
     -- Sender not in active players list? (e.g. if they just left?)
     -- If we didn't filter has_left above, we would find them.
     -- If we filter, and they left, they aren't found.
     -- If they aren't found, we can't calculate 'next' relative to them easily here.
     -- But this trigger fires for Normal Messages. Normal senders shouldn't have left.
     -- So return (no turn update)?
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
$$ LANGUAGE plpgsql;
