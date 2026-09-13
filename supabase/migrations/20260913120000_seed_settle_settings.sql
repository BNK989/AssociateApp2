-- The settle drip: a fourth game_settings key, for the rung between the last
-- hint and giving up.
--
-- The hint ladder ends at the AI clue. A player who has the anagram and the
-- clue and still cannot see the word has exactly one move left -- reveal it --
-- and that move scores zero. This adds a rung before it: the letters already
-- hanging around the word, which the player has found but has nowhere to put,
-- walk into their real positions one at a time until either the player gets it
-- or a configured ceiling stops them.
--
-- It gives away POSITIONS, never new letters. Everything it places was already
-- visible in the pool. That is what makes it a distinct rung rather than a
-- cheaper hint: hint level 2 deliberately destroys positional information by
-- turning the mask into an anagram, and this is the only thing in the game that
-- gives any of it back.
--
-- What is tunable from here is everything a balancing pass needs and nothing
-- that would break the board: the mode, the pacing, the two independent
-- ceilings, which letter goes next, and what a settled letter costs. The mode
-- default is 'offered' -- the game speaks first and the player accepts, which
-- is the rule the rest of the stuck machinery already follows. 'auto' places
-- letters unasked and is the other arm of the experiment; 'off' removes the
-- rung entirely.
--
-- The row is seeded EMPTY, exactly like the three keys before it. An absent
-- field falls back to the compiled constant in src/lib/gameConfig.ts (SETTLE)
-- through a total parser (src/lib/daily/settlePolicy.ts), so this row cannot
-- drift from the code the way a spelled-out copy of the defaults would -- and a
-- database that never gets this migration plays exactly as the code does.
--
-- That last point matters more here than for the other keys. The compiled
-- default is 'offered', so the rung exists whether or not this migration is
-- applied; the migration buys the ability to TUNE it without a deploy, not the
-- feature itself. A fallback of 'off' would have made the whole mechanic
-- silently conditional on a migration nobody remembered to run.
--
-- Scope is 'default' and is never read for this key. There is no per-player
-- preference for 'force' to override: a player who wants no help declines the
-- offer, which is the entire point of offering rather than imposing.
--
-- READS ARE PUBLIC, as with every row in this table -- guests play the daily
-- game with no session. Nothing secret goes in here; it is world-readable by
-- design. Writes remain service-role only, through /api/admin/game-settings.

begin;

insert into public.game_settings (key, value, scope, revision)
values ('settle', '{}'::jsonb, 'default', 1)
on conflict (key) do nothing;

commit;
