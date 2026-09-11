-- The letter pool: a third game_settings key, for how the answer box takes typing.
--
-- Found-but-unplaced letters now sit in a pool above the composer rather than
-- inside the word line, because a letter drawn inside a line of text is read as
-- being *at* that spot no matter what colour, tilt or drift says otherwise. The
-- composer then draws the answer's shape, with confirmed letters filled in.
--
-- What is tunable here is the one genuinely open question in that design:
-- whether the cursor skips over confirmed letters, so the player types only the
-- gaps, or whether they type the whole answer with confirmed letters acting as
-- checkpoints. Both are defensible, neither is obviously right, and which one
-- feels better is a question about players rather than about code -- which is
-- exactly the kind of question that should not need a deploy to re-ask.
--
-- Whether the pool exists at all is deliberately NOT tunable from here. That
-- decides what the word line draws, and it is read by client modules that have
-- no route to a server-side setting; a switch that applied to half the screen
-- would be worse than no switch. It stays LETTER_POOL.ENABLED in
-- src/lib/gameConfig.ts.
--
-- The row is seeded EMPTY, exactly like daily_hint_policy and daily_feedback.
-- An absent field falls back to the compiled constant in src/lib/gameConfig.ts
-- (LETTER_POOL) through a total parser (src/lib/daily/letterPoolPolicy.ts), so
-- this row cannot drift from the code the way a spelled-out copy of the
-- defaults would -- and a database that never gets this migration plays exactly
-- as it does today.
--
-- Scope is 'default' and is never read for this key. There is no per-player
-- preference for 'force' to override: the caret rule is how the composer
-- behaves, not a preference a player has expressed.
--
-- READS ARE PUBLIC, as with every row in this table -- guests play the daily
-- game with no session. Nothing secret goes in here; it is world-readable by
-- design. Writes remain service-role only, through /api/admin/game-settings.

begin;

insert into public.game_settings (key, value, scope, revision)
values ('letter_pool', '{}'::jsonb, 'default', 1)
on conflict (key) do nothing;

commit;
