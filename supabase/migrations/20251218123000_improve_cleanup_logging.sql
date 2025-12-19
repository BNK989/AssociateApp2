-- Drop the old function (signature must match exactly to drop)
DROP FUNCTION IF EXISTS cleanup_games_logic();

-- Recreate the function with a TEXT return type
CREATE OR REPLACE FUNCTION cleanup_games_logic()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    archived_count integer;
    deleted_count integer;
BEGIN
    -- Archive games: Inactive for > 72 hours
    UPDATE games 
    SET 
        status = 'archived', 
        archived_at = NOW()
    WHERE 
        status != 'archived' 
        AND COALESCE(last_activity_at, created_at) < (NOW() - INTERVAL '72 hours');
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;

    -- Delete games: Archived for > 7 days
    DELETE FROM games 
    WHERE 
        status = 'archived' 
        AND archived_at < (NOW() - INTERVAL '7 days');
        
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Return a summary string
    RETURN format('Archived: %s games, Deleted: %s games', archived_count, deleted_count);
END;
$$;
