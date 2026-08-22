-- Lock down EXECUTE on public functions.
--
-- Every function in `public` was left with the Postgres default of
-- EXECUTE TO PUBLIC, which PostgREST exposes at /rest/v1/rpc/<name> to the
-- `anon` role — i.e. to anyone holding the publishable anon key that ships in
-- the browser bundle. Several of these are SECURITY DEFINER, so they also
-- bypass row-level security.
--
-- Verified against production before writing this migration:
--   POST /rest/v1/rpc/distribute_game_points  as anon  ->  HTTP 204
--
-- distribute_game_points takes the recipient and the amount as arguments and
-- performs no authorisation check of its own, so that call is an arbitrary
-- score write available to an unauthenticated caller. It is the reason this
-- migration exists; the rest is closing the same door on its neighbours.
--
-- ORDERING: deploy the application change that routes distribute_game_points
-- through the service-role client BEFORE applying this migration. The code
-- works either way; this migration removes the grant the old code relied on.

begin;

-- ---------------------------------------------------------------------------
-- Server-only. Called by pg_cron (which runs as `postgres` and is unaffected
-- by these grants) or by our own API routes using the service role.
-- ---------------------------------------------------------------------------

-- Awards points. No internal authorisation; must never be client-callable.
revoke all on function public.distribute_game_points(uuid, uuid, integer, uuid, integer) from public, anon, authenticated;
grant execute on function public.distribute_game_points(uuid, uuid, integer, uuid, integer) to service_role;

-- Archives and deletes games. Cron job `daily-cleanup`.
revoke all on function public.cleanup_games_logic() from public, anon, authenticated;
grant execute on function public.cleanup_games_logic() to service_role;

-- Deletes expired guest accounts from auth.users. Cron job `delete-guest-users`.
revoke all on function public.delete_expired_guests() from public, anon, authenticated;
grant execute on function public.delete_expired_guests() to service_role;

-- Score/pot mutators. Not referenced anywhere in the application; kept in place
-- rather than dropped, but no longer reachable from a client.
revoke all on function public.increment_score(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_score(uuid, uuid, integer) to service_role;

revoke all on function public.increment_team_pot(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_team_pot(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Trigger functions. A trigger fires as the table owner and does not consult
-- EXECUTE grants, so revoking here does not affect them — it only removes them
-- from the REST surface, where they were never meant to appear.
-- ---------------------------------------------------------------------------

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_message() from public, anon, authenticated;
revoke all on function public.update_last_activity() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Genuinely client-callable. Both derive the actor from auth.uid() and raise
-- if it is null, so they are safe for signed-in users but pointless for anon.
-- Guests sign in anonymously and carry the `authenticated` role, so they keep
-- access.
-- ---------------------------------------------------------------------------

revoke all on function public.send_game_message(uuid, text, integer, text, integer) from public, anon;
grant execute on function public.send_game_message(uuid, text, integer, text, integer) to authenticated, service_role;

revoke all on function public.player_leave_game(uuid) from public, anon;
grant execute on function public.player_leave_game(uuid) to authenticated, service_role;

commit;
