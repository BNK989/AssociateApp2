CREATE OR REPLACE FUNCTION send_game_message(
  p_game_id UUID,
  p_content TEXT,
  p_cipher_length INT,
  p_cipher_text TEXT,
  p_potential_value INT -- Assumed to be > 0 only for correct guesses/new messages
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_user_id UUID;
  v_exists BOOLEAN;
  v_game_status TEXT;
  v_max_messages INT;
  v_current_count INT;
  v_current_pot INT;
  v_next_player_id UUID;
  v_players UUID[];
  v_current_player_index INT;
BEGIN
  -- Get user ID from auth.uid()
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 0. Check Game Status & Limit
  SELECT status, max_messages, team_pot INTO v_game_status, v_max_messages, v_current_pot
  FROM games WHERE id = p_game_id;

  -- Allow message if Lobby OR Texting. 
  IF v_game_status NOT IN ('lobby', 'texting', 'active') THEN
     RAISE EXCEPTION 'Cannot send messages in current game state: %', v_game_status;
  END IF;

  -- 1. Check for duplicate content (case-insensitive)
  SELECT EXISTS (
    SELECT 1 FROM messages
    WHERE game_id = p_game_id
    AND content ILIKE p_content
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Message already exists in this game';
  END IF;

  -- 2. Insert Message
  INSERT INTO messages (
    game_id,
    user_id,
    content,
    cipher_length,
    cipher_text,
    is_solved,
    strikes,
    hint_level,
    winner_points,
    author_points,
    created_at
  ) VALUES (
    p_game_id,
    v_user_id,
    p_content,
    p_cipher_length,
    p_cipher_text,
    false,
    0,
    0,
    0,
    0,
    now()
  ) RETURNING id INTO v_message_id;

  -- 3. Calculate Turn & Update Game
  
  -- Fetch all players ordered by join time to determine turn order
  SELECT ARRAY(
      SELECT user_id 
      FROM game_players 
      WHERE game_id = p_game_id 
      ORDER BY joined_at ASC
  ) INTO v_players;

  -- Find current user's index (1-based in SQL arrays usually, but let's use array_position)
  v_current_player_index := array_position(v_players, v_user_id);
  
  IF v_current_player_index IS NULL THEN
     RAISE EXCEPTION 'User not found in game players';
  END IF;

  -- Calculate next index (wrapping around)
  -- If index is last, next is 1. Else index + 1.
  IF(v_current_player_index = array_length(v_players, 1)) THEN
      v_next_player_id := v_players[1];
  ELSE
      v_next_player_id := v_players[v_current_player_index + 1];
  END IF;

  -- Update Game: Pot, Turn, Status
  UPDATE games 
  SET 
    team_pot = COALESCE(team_pot, 0) + p_potential_value,
    current_turn_user_id = v_next_player_id,
    status = CASE WHEN status = 'lobby' THEN 'texting' ELSE status END
  WHERE id = p_game_id;

  -- 4. Check Message Limit & Auto-Switch to Solving
  IF v_max_messages IS NOT NULL THEN
      SELECT count(*) INTO v_current_count FROM messages WHERE game_id = p_game_id;
      
      IF v_current_count >= v_max_messages THEN
          UPDATE games 
          SET 
            status = 'solving',
            solving_started_at = now()
          WHERE id = p_game_id;
      END IF;
  END IF;

  RETURN jsonb_build_object('id', v_message_id, 'success', true);
END;
$$;
