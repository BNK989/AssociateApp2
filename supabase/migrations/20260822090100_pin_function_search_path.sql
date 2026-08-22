-- Pin search_path on public functions.
--
-- A function without an explicit search_path resolves unqualified names using
-- the caller's path. For a SECURITY DEFINER function that is an escalation
-- route: anyone able to create an object in a schema that appears earlier in
-- that path can shadow a table or function the body refers to and have it run
-- with the definer's privileges.
--
-- Setting it to `public, pg_temp` keeps the existing unqualified references
-- working while fixing resolution. pg_temp is listed last deliberately — left
-- implicit it is searched first, which is itself the shadowing vector.
--
-- delete_expired_guests already sets its own path and is left alone.

begin;

-- SECURITY DEFINER: the escalation risk is real for these.
alter function public.distribute_game_points(uuid, uuid, integer, uuid, integer) set search_path = public, pg_temp;
alter function public.cleanup_games_logic() set search_path = public, pg_temp;
-- Fires on auth.users but its body only writes public.profiles, fully qualified.
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.send_game_message(uuid, text, integer, text, integer) set search_path = public, pg_temp;
alter function public.player_leave_game(uuid) set search_path = public, pg_temp;

-- SECURITY INVOKER: these run with the caller's own rights, so the risk is
-- lower, but a predictable path is still the correct default.
alter function public.increment_score(uuid, uuid, integer) set search_path = public, pg_temp;
alter function public.increment_team_pot(uuid, integer) set search_path = public, pg_temp;
alter function public.handle_new_message() set search_path = public, pg_temp;
alter function public.update_last_activity() set search_path = public, pg_temp;

commit;
