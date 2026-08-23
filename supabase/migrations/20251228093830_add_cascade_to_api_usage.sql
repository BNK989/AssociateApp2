-- Cascade api_usage.game_id when a game is deleted.
--
-- Recovered from the deployed migration history on 2026-08-23. This ran against
-- production on 2025-12-28 but had no file in the repo, so a rebuilt database
-- was left with a RESTRICT foreign key here and game cleanup would fail against
-- any game that had used an AI hint.
--
-- Note this is the *game* key. 20251218130000_fix_api_usage_fk.sql handles the
-- separate user key, which cascades for guest cleanup.

-- IF EXISTS is a deliberate addition to the recovered statement: on a fresh
-- database the constraint is created under a generated name by the table
-- definition, and a bare DROP would abort the rebuild.
ALTER TABLE public.api_usage
DROP CONSTRAINT IF EXISTS api_usage_game_id_fkey;

ALTER TABLE public.api_usage
ADD CONSTRAINT api_usage_game_id_fkey
FOREIGN KEY (game_id)
REFERENCES games(id)
ON DELETE CASCADE;
