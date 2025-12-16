CREATE OR REPLACE FUNCTION player_leave_game(
  p_game_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_username TEXT;
  v_game_status TEXT;
  v_current_turn_user_id UUID;
  v_target_message_author_id UUID;
  v_active_players UUID[];
  v_next_player_id UUID;
  v_all_players UUID[];
  v_leaver_index INT;
  v_next_index INT;
  v_loop_count INT;
BEGIN
  -- 1. Get User
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Update Player Status
  UPDATE game_players 
  SET has_left = true 
  WHERE game_id = p_game_id AND user_id = v_user_id;

  -- 3. Get Username (for message)
  SELECT username INTO v_username 
  FROM profiles 
  WHERE id = v_user_id;
  
  -- 4. Insert System Message
  INSERT INTO messages (
    game_id,
    user_id,
    content,
    type,
    is_solved,
    cipher_length,
    strikes,
    hint_level,
    winner_points,
    author_points,
    created_at
  ) VALUES (
    p_game_id,
    v_user_id,
    COALESCE(v_username, 'Player') || ' left the game',
    'system',
    true, -- Auto-solved so it doesn't block
    0,
    0,
    0,
    0,
    0,
    now()
  );

  -- 5. Fetch Game Data
  SELECT status, current_turn_user_id INTO v_game_status, v_current_turn_user_id
  FROM games
  WHERE id = p_game_id;

  -- 6. Turn Rotation (if leaver was active turn)
  IF v_current_turn_user_id = v_user_id THEN
      -- Get all players to determine order
      SELECT ARRAY(
          SELECT user_id 
          FROM game_players 
          WHERE game_id = p_game_id 
          ORDER BY joined_at ASC
      ) INTO v_all_players;

      -- Get active players set
      SELECT ARRAY(
          SELECT user_id 
          FROM game_players 
          WHERE game_id = p_game_id AND has_left = false
      ) INTO v_active_players;

      IF array_length(v_active_players, 1) > 0 THEN
          v_leaver_index := array_position(v_all_players, v_user_id);
          
          -- Round robin logic to find next ACTIVE player
          -- Start checking from leaver_index + 1
          v_next_index := v_leaver_index + 1;
          v_loop_count := 0;
          
          LOOP
              IF v_next_index > array_length(v_all_players, 1) THEN
                  v_next_index := 1;
              END IF;
              
              v_next_player_id := v_all_players[v_next_index];
              
              -- If this player is active, pick them
              IF v_next_player_id = ANY(v_active_players) THEN
                  EXIT;
              END IF;
              
              v_next_index := v_next_index + 1;
              v_loop_count := v_loop_count + 1;
              
              -- Safety break
              IF v_loop_count > array_length(v_all_players, 1) THEN
                  -- Fallback to first active if something is weird
                  v_next_player_id := v_active_players[1];
                  EXIT;
              END IF;
          END LOOP;

          -- Update Game Turn
          UPDATE games 
          SET current_turn_user_id = v_next_player_id 
          WHERE id = p_game_id;
      END IF;
  END IF;

  -- 7. Solving Mode Logic (Force Free-For-All if Author Left)
  IF v_game_status = 'solving' THEN
      -- Find Author of the latest active (unsolved) message
      -- Relaxed Logic: Find ANY recent unsolved message by this user?
      -- OR Just stick to logic: Latest Unsolved.
      SELECT user_id INTO v_target_message_author_id
      FROM messages
      WHERE game_id = p_game_id
      AND is_solved = false
      AND strikes < 3
      ORDER BY created_at DESC
      LIMIT 1;
      
      -- Also check if there is NO target message found (rare edge case)
      -- Or if the Target Message Author IS the User
      IF v_target_message_author_id = v_user_id THEN
          -- Force Free For All by setting start time to 1 hour ago
          UPDATE games 
          SET solving_started_at = (now() - interval '1 hour')
          WHERE id = p_game_id;
      END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
