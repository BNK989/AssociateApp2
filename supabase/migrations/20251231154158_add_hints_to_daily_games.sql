-- The daily chain's authored hints.
--
-- Recovered from the deployed migration history on 2026-08-23. This ran against
-- production on 2025-12-31 but had no file in the repo, which meant a rebuilt
-- database had no `hints` column at all — and the daily game reads it on every
-- page load (src/app/[locale]/daily/page.tsx calls ensureDailyHints against it).
-- A fresh environment would have failed to serve a daily game.

ALTER TABLE daily_games ADD COLUMN IF NOT EXISTS hints jsonb;
