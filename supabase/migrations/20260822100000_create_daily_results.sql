-- Daily game results: the measurement layer for the daily challenge.
--
-- The daily game has always been client-side only. Progress lives in
-- localStorage and nothing reaches the server, which leaves two questions
-- unanswerable: how long a chain actually takes to play, and at which word
-- players give up. Both gate the open decision on how long a daily chain
-- should be, so the length ramp cannot be tuned until this table exists.
--
-- Rows are written PROGRESSIVELY -- after every word resolves, not only on
-- completion. A player who abandons at word 8 of 12 never reaches a completion
-- event, and abandonment is precisely the signal we are after. The last row
-- state for a (client_id, play_date) is therefore how far that player got.
--
-- WRITES ARE SERVER-ONLY. RLS is enabled with no INSERT or UPDATE policy, so
-- the anon key that ships in the browser bundle cannot write here at all;
-- /api/daily/result writes through the service-role client. This follows the
-- posture set in 20260822090000_lock_down_function_execute.sql -- a privileged
-- write goes through an API route, never through a client-side grant.

begin;

create table if not exists public.daily_results (
    id uuid primary key default gen_random_uuid(),

    -- Stable per-browser id minted in localStorage. Present for every player,
    -- signed in or not. Guests are not anonymous auth users in this app (there
    -- are none), they simply have no session, so user_id alone would record
    -- only the registered minority and bias every drop-off number we read.
    client_id text not null,

    -- Set when the player has a session. Null for guests.
    user_id uuid references auth.users(id) on delete set null,

    play_date date not null,

    words_total smallint not null,
    words_solved smallint not null default 0,
    score integer not null default 0,
    hints_used smallint not null default 0,
    strikes smallint not null default 0,

    -- Sum of the per-word active times. Wall-clock time with the tab hidden is
    -- excluded, and each word is capped, so this is attention rather than the
    -- span between opening and finishing.
    duration_ms integer not null default 0,

    completed boolean not null default false,

    -- One entry per resolved word, in play order:
    --   { index, outcome, hint_level, strikes, points, ms }
    -- outcome is 'solved' | 'gave_up' | 'struck_out'.
    -- Length is how far the player got; this is the drop-off histogram.
    per_word jsonb not null default '[]'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- One row per browser per day. A signed-in player on two devices produces two
-- rows; that is acceptable for measurement, and streak queries later aggregate
-- on coalesce(user_id::text, client_id) rather than on this key.
create unique index if not exists daily_results_client_date_idx
    on public.daily_results (client_id, play_date);

-- Aggregation reads are all "everyone who played day X".
create index if not exists daily_results_play_date_idx
    on public.daily_results (play_date);

-- Streak lookups, once those land.
create index if not exists daily_results_user_date_idx
    on public.daily_results (user_id, play_date)
    where user_id is not null;

alter table public.daily_results enable row level security;

-- Read-only, own rows, signed-in players. Deliberately no INSERT or UPDATE
-- policy: writes are service-role only, via /api/daily/result.
create policy "Players read their own results"
    on public.daily_results
    for select
    to authenticated
    using (user_id = auth.uid());

comment on table public.daily_results is
    'Per-player outcome of a daily chain. Written progressively by /api/daily/result via the service role; see CLAUDE.md and knowledge base/daily_game_backend_logic.md.';

commit;
