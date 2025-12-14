DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_status') THEN
        ALTER TYPE game_status ADD VALUE IF NOT EXISTS 'archived';
    END IF;
END
$$;

ALTER TABLE games ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
