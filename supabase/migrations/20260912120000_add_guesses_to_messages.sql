-- Wrong guesses recorded against a word, which is what colours its tiles.
--
-- The classic multiplayer room had nowhere to put them. `computeGuessState`
-- reads `guesses` on every render of a masked word, and every renderer already
-- passes `message.guesses` through, but nothing ever wrote it: the daily game
-- keeps its copy in client state, and the room's wrong-guess path recorded only
-- a strike. A player who guessed "deven" for "seven" had earned four confirmed
-- letters and was shown none of them.
--
-- Shared across the room rather than per player, exactly like `hint_level` on
-- the same row: a room is cooperative and pays for its hints out of one pot, so
-- a letter one player exposes is a letter the table has.
alter table "public"."messages"
add column if not exists "guesses" text[] not null default '{}'::text[];

comment on column "public"."messages"."guesses" is
  'Wrong guesses made against this word, oldest first. Read by computeGuessState to colour confirmed (green) and found (orange) letters. Shared by every player in the room, like hint_level.';
