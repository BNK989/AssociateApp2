-- 1. Add the 'archived_at' column safely
DO $$
BEGIN
    -- Add the column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'archived_at') THEN
        ALTER TABLE games ADD COLUMN archived_at TIMESTAMPTZ;
    END IF;

    -- Update the enum type if it exists and doesn't have 'archived'
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_status') THEN
        ALTER TYPE game_status ADD VALUE IF NOT EXISTS 'archived';
    END IF;
END
$$;

-- 2. Create the Cleanup Function (The logic runs inside your DB)
CREATE OR REPLACE FUNCTION cleanup_games_logic()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Archive games: Inactive for > 72 hours
    -- "Inactive" means last_activity_at is older than 72 hours ago
    UPDATE games 
    SET 
        status = 'archived', 
        archived_at = NOW()
    WHERE 
        status != 'archived' 
        -- Use created_at if last_activity_at is null
        AND COALESCE(last_activity_at, created_at) < (NOW() - INTERVAL '72 hours');

    -- Delete games: Archived for > 7 days
    DELETE FROM games 
    WHERE 
        status = 'archived' 
        AND archived_at < (NOW() - INTERVAL '7 days');
END;
$$;

-- 3. Enable pg_cron (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 4. Schedule the job to run every day at 3:00 AM
-- Note: 'daily-cleanup' is the unique name of the job
SELECT cron.schedule(
    'daily-cleanup',   -- Unique job name
    '0 3 * * *',       -- Cron schedule (3:00 AM daily)
    $$SELECT cleanup_games_logic()$$ -- Command to execute
);

-- Optional: Run it once immediately to verify it doesn't crash
SELECT cleanup_games_logic();
