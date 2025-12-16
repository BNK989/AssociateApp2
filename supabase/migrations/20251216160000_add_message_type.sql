DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'type') THEN 
        ALTER TABLE messages ADD COLUMN type text DEFAULT 'text';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_players' AND column_name = 'has_left') THEN 
        ALTER TABLE game_players ADD COLUMN has_left boolean DEFAULT false;
    END IF;
END $$;
