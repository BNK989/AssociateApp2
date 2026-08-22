-- Game-master controls: tunable game settings that do not need a deploy.
--
-- Until now the daily game's balance lived entirely in compiled constants
-- (src/lib/gameConfig.ts). Changing how long a player waits for the first hint,
-- or whether a word opens with its first letter already showing, meant editing
-- code and shipping to production. That is a poor loop for a game that needs
-- tuning against real play data.
--
-- One row per setting key. `value` is a jsonb blob parsed on read by a total
-- parser (src/lib/daily/hintPolicy.ts) that clamps and falls back per field, so
-- a malformed value degrades to the compiled default rather than taking the
-- daily game down. The constants remain the floor beneath this table: if it is
-- empty, unreachable, or full of nonsense, the game plays exactly as it does
-- today.
--
-- READS ARE PUBLIC. Guests play the daily game with no session, so anon must be
-- able to read this table or the settings would apply only to signed-in
-- players. NOTHING SECRET GOES IN HERE -- not model names, not thresholds that
-- reveal answers, not keys. It is world-readable by design.
--
-- WRITES ARE SERVER-ONLY. RLS is enabled with no insert or update policy, so
-- the anon key shipped in the browser bundle cannot write here at all. Writes
-- go through /api/admin/game-settings using the service role, after an is_admin
-- check. This follows the posture set in 20260822090000_lock_down_function_
-- execute.sql and 20260822100000_create_daily_results.sql -- a privileged write
-- goes through an API route, never through a client-side grant.

begin;

create table if not exists public.game_settings (
    key text primary key,

    value jsonb not null default '{}'::jsonb,

    -- 'default' seeds only players who have stored no preference of their own;
    -- 'force' overrides everyone. Balancing wants 'force': a game master who
    -- has ever opened the info screen has preferences saved in
    -- profiles.settings, so under 'default' their own account would not move
    -- and the admin panel would look broken.
    scope text not null default 'default'
        check (scope in ('default', 'force')),

    -- Monotonic counter bumped on every write, stamped onto daily_results rows
    -- so an outcome can be attributed to the configuration that produced it.
    -- Without this, "did the change help?" is unanswerable: a timestamp alone
    -- cannot tell you which players were still running a cached older config.
    revision integer not null default 1,

    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

-- Every change, kept for as long as it is useful. Answers "what did we change
-- on the 14th, and who changed it" when a metric moves, and backs one-click
-- rollback to a previous revision.
create table if not exists public.game_settings_history (
    id uuid primary key default gen_random_uuid(),
    key text not null,
    value jsonb not null,
    scope text not null,
    revision integer not null,
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists game_settings_history_key_revision_idx
    on public.game_settings_history (key, revision desc);

alter table public.game_settings enable row level security;
alter table public.game_settings_history enable row level security;

-- Readable by everyone, signed in or not. See the header: guests play too, and
-- nothing secret belongs in this table.
create policy "Anyone reads game settings"
    on public.game_settings
    for select
    to anon, authenticated
    using (true);

-- History is an operational record, not player-facing. Deliberately no policy:
-- deny-all for anon and authenticated, service role only.

comment on table public.game_settings is
    'Game-master tunables, editable from /admin/game-settings without a deploy. '
    'World-readable by design (guests play the daily game) — never store secrets here. '
    'Writes are service-role only via /api/admin/game-settings. Values are parsed by a '
    'total parser that falls back to the compiled defaults in src/lib/gameConfig.ts.';

comment on column public.game_settings.revision is
    'Bumped on every write and stamped onto daily_results, so play outcomes can be '
    'attributed to the configuration that produced them.';

comment on table public.game_settings_history is
    'Append-only audit trail of game_settings writes. Service-role only.';

-- Seed the daily hint policy as an empty object rather than a spelled-out
-- default. An absent field falls back to the compiled constant, so an empty
-- blob means "whatever the code says" — and the seeded row cannot drift from
-- gameConfig.ts the way a duplicated copy of the defaults would.
insert into public.game_settings (key, value, scope, revision)
values ('daily_hint_policy', '{}'::jsonb, 'default', 1)
on conflict (key) do nothing;

commit;
