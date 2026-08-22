-- Attribute each play to the configuration that produced it.
--
-- game_settings.revision is bumped on every write. Stamping it here is what
-- turns the game-master controls from a set of knobs into an improvement loop:
-- without it, "did raising the start level help?" is unanswerable. A timestamp
-- alone cannot answer it, because players cache their game in localStorage and
-- keep playing the previous configuration for the rest of the day -- so results
-- either side of a change are not cleanly split by time.
--
-- Nullable, and zero is meaningful:
--   NULL -- recorded before this column existed.
--   0    -- played against the compiled defaults, because game_settings could
--           not be read (see NO_REVISION in src/lib/gameSettings/settingsRow.ts).
--   >=1  -- played against that stored revision.

begin;

alter table public.daily_results
    add column if not exists settings_revision integer;

comment on column public.daily_results.settings_revision is
    'game_settings.revision in force when this game was played. NULL predates the '
    'column; 0 means the settings table could not be read and the compiled defaults '
    'were used. Group outcomes by this to compare configurations.';

-- Outcome queries are "this configuration, over these days".
create index if not exists daily_results_revision_date_idx
    on public.daily_results (settings_revision, play_date);

commit;
