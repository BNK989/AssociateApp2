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
BEGIN
  -- Get user ID from auth.uid()
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 0. Check Game Status & Limit
  SELECT status, max_messages INTO v_game_status, v_max_messages
  FROM games WHERE id = p_game_id;

  IF v_game_status != 'texting' THEN
     -- If game is already solving/completed, we might block regular messages
     -- But let's assume UI handles current_turn logic. 
     -- This RPC is specifically for "sending" a new message to solve.
     NULL; 
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

  -- 3. Increment Team Pot
  IF p_potential_value > 0 THEN
    PERFORM increment_team_pot(game_id_param := p_game_id, amount := p_potential_value);
  END IF;

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
