# Database Security

Who can call what, and why. Read this before adding a Postgres function or an
RLS policy.

---

## For Product Managers (Non-Technical)

The game's database is reachable directly from the internet — that is how
Supabase works, and it is why every table and function needs to say explicitly
who may touch it.

An audit on 2026-08-22 found one door genuinely open: a database routine that
**awards points** could be called by anybody at all, with no login, choosing who
got the points and how many. It was confirmed working against production before
being fixed. Points are now awarded only by our own server.

Nothing suggests it was used. Scores are worth checking if anything looks off.

Three things still need a person to act on them; they are listed at the bottom.

---

## For Developers (Technical)

### The exposure model

Supabase serves the `public` schema over PostgREST. Anything in it is reachable
at `/rest/v1/...` by anyone holding the anon key — which ships in the browser
bundle and is not a secret. Two consequences:

- **A Postgres function in `public` is a public HTTP endpoint** unless its
  EXECUTE grant says otherwise. The Postgres default is `EXECUTE TO PUBLIC`,
  so a newly created function is world-callable until you revoke it.
- **`SECURITY DEFINER` bypasses RLS.** A definer function with no internal
  authorisation check is an unguarded write, whatever the table policies say.

Only `public` and `graphql_public` are exposed. `cron`, `auth` and the rest are
not reachable over REST — verified, not assumed.

### Roles

| Role | Who |
| :--- | :--- |
| `anon` | Anyone with the anon key and no session — i.e. the open internet |
| `authenticated` | Any signed-in user, **including guests** (anonymous sign-in issues a real JWT with this role) |
| `service_role` | Our server routes only. Bypasses RLS. Never leaves the server |

Guests being `authenticated` matters: locking something to `authenticated` does
**not** exclude guests.

### Function grants

Set by `20260822090000_lock_down_function_execute.sql`.

| Function | Callable by | Why |
| :--- | :--- | :--- |
| `distribute_game_points` | service_role | Awards arbitrary points to an arbitrary user. No internal auth check. Server-only |
| `cleanup_games_logic` | service_role | Archives and deletes games. Cron |
| `delete_expired_guests` | service_role | Deletes auth users. Cron |
| `increment_score`, `increment_team_pot` | service_role | Unreferenced score mutators |
| `handle_new_user`, `handle_new_message`, `update_last_activity` | nobody | Triggers. They fire as the table owner and never consult EXECUTE |
| `send_game_message` | authenticated | Derives the actor from `auth.uid()` and raises if null |
| `player_leave_game` | authenticated | Same, and only affects the caller's own row |

**Adding a function?** Revoke from `public, anon` in the same migration, then
grant only the role that needs it. If it is `SECURITY DEFINER`, it must derive
the actor from `auth.uid()` rather than taking it as an argument — otherwise the
argument *is* the authorisation.

### search_path

Every function pins `search_path = public, pg_temp`
(`20260822090100_pin_function_search_path.sql`). Without it, unqualified names
resolve through the caller's path, which lets anyone who can create objects in
an earlier schema shadow a table and have it run with the definer's rights.
`pg_temp` is listed last on purpose — left implicit, it is searched first, which
is the shadowing vector itself.

### api_usage is deny-all on purpose

RLS is on with **no policies**, so anon and authenticated are denied entirely and
only `service_role` can touch it. The advisor reports this as a finding; it is
the intended state. A readable ledger leaks other players' usage, a writable one
lets a client reset its own quota.

The AI-hint route therefore **fails closed**: with no service key configured it
returns 503 rather than falling back to a client-scoped read, which would return
a count of zero and silently make hints unlimited.

---

## Open items needing a decision

These are not code changes and are left for a human.

1. **Leaked-password protection is off.** Dashboard → Authentication → Policies.
   Checks new passwords against HaveIBeenPwned. One toggle.

2. **A `service_role` JWT is stored in plaintext** in `cron.job.command`, for the
   `generate-daily-hints` job. Not reachable over REST — the `cron` schema is not
   exposed, and its RLS restricts rows to the job owner — but it is a live
   credential sitting in a table, readable by anything with database access.
   Consider Vault, or scheduling the edge function outside pg_cron.

3. **`games` UPDATE policy is `USING (true) WITH CHECK (true)`.** Any signed-in
   user can modify any game row — status, turn, team pot — including games they
   are not in. Similarly `game_players` UPDATE has `USING (auth.uid() = user_id)`
   with no `WITH CHECK`, so a player can set their own score to anything. Both
   are outside the advisor's findings and need a product decision about how much
   the client is trusted, since tightening them may require routing more writes
   through the server.
