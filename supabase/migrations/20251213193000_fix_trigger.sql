CREATE OR REPLACE FUNCTION handle_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_game_status text;
  v_current_turn_user_id uuid;
  v_next_player_id uuid;
  v_player_ids uuid[];
  v_current_player_index int;
  v_message_count int;
BEGIN
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
  
  -- If v_message_count is 0, it means this NEW message is the first one (since this is BEFORE insert? OR AFTER?)
  -- Wait, triggers are usually fired AFTER insert for constraints OR BEFORE.
  -- The previous code checked v_current_turn_user_id != NEW.user_id.
  -- We just need to check if there are any EXISTING messages.
  -- Since this trigger seems to be used for logic *including* updating the turn, let's see.
  
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
$$ LANGUAGE plpgsql;
