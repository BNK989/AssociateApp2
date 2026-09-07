-- Reward feedback: a second game_settings key, for how a correct guess feels.
--
-- Sound and the "+points" flourish were previously fixed in code -- one mp3
-- chime at one volume, and a green "+N" that looked identical whether the
-- player had cracked a word unaided on a streak or been handed the answer by
-- the AI clue. Both are now graded and both are tunable without a deploy, for
-- the same reason the hint policy is: reward feel cannot be judged from a
-- number, and a tuning loop that needs a production deploy is a loop nobody
-- runs.
--
-- The row is seeded EMPTY, exactly like daily_hint_policy. An absent field
-- falls back to the compiled constant in src/lib/gameConfig.ts (REWARD_FEEDBACK)
-- via a total parser (src/lib/daily/feedbackPolicy.ts), so this row cannot drift
-- from the code the way a spelled-out copy of the defaults would -- and a
-- database that never gets this migration plays exactly as it does today.
--
-- Scope is 'default' and is never read for this key. Reward audio has no
-- 'force': a player who has muted the game stays muted whatever a game master
-- sets, so there is nothing for the column to express here. See
-- resolveFeedbackPolicy in src/lib/daily/feedbackPolicy.ts.
--
-- READS ARE PUBLIC, as with every row in this table -- guests play the daily
-- game with no session. Nothing secret goes in here; it is world-readable by
-- design. Writes remain service-role only, through /api/admin/game-settings.

begin;

insert into public.game_settings (key, value, scope, revision)
values ('daily_feedback', '{}'::jsonb, 'default', 1)
on conflict (key) do nothing;

commit;
