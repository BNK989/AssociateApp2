CREATE OR REPLACE FUNCTION send_game_message(
  p_game_id UUID,
  p_content TEXT,
  p_cipher_length INT,
  p_cipher_text TEXT,
  p_potential_value INT
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
    type, 
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
    'text', -- Explicitly set type to text
    0,
    0,
    now()
  ) RETURNING id INTO v_message_id;

  -- 3. Calculate Turn & Update Game
  
  -- Fetch all ACTIVE players ordered by join time
  SELECT ARRAY(
      SELECT user_id 
      FROM game_players 
      WHERE game_id = p_game_id 
      AND has_left = false    -- <--- CHANGED: Filter out left players
      ORDER BY joined_at ASC
  ) INTO v_players;

  -- Find current user's index
  v_current_player_index := array_position(v_players, v_user_id);
  
  -- It's possible the sender JUST left or something, but usually they are sending so they are active.
  -- Use coalesce or check null if we want to be safe, but robust logic assumes sender is active.
  IF v_current_player_index IS NULL THEN
     -- Fallback: If sender is not in active list (maybe they are sending but marked left?), pick first active player?
     -- Or just raise exception?
     -- For now, robustly pick the first active player if sender is weirdly missing.
     v_next_player_id := v_players[1];
  ELSE
      -- Calculate next index (wrapping around)
      IF(v_current_player_index = array_length(v_players, 1)) THEN
          v_next_player_id := v_players[1];
      ELSE
          v_next_player_id := v_players[v_current_player_index + 1];
      END IF;
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
