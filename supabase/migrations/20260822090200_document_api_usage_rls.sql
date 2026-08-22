-- Record that api_usage is deliberately deny-all.
--
-- The advisor reports "RLS enabled, no policies" on this table. That is the
-- intended configuration, not an oversight: RLS with no policy denies every
-- read and write to anon and authenticated, while service_role bypasses RLS
-- entirely. The table holds AI-hint rate-limit counters, which only the server
-- writes and only the server needs to read — a client able to read them could
-- see other players' usage, and one able to write them could reset its own
-- quota.
--
-- A comment cannot silence the advisor, but it stops the next person "fixing"
-- the finding by adding a permissive policy.

comment on table public.api_usage is
    'AI-hint rate-limit ledger. RLS is intentionally enabled with NO policies: '
    'deny-all for anon and authenticated. Written and read only via the service '
    'role from server routes. Do not add a policy — a readable ledger leaks other '
    'players usage, and a writable one lets a client reset its own quota.';
