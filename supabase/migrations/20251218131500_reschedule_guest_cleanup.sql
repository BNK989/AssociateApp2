-- Reschedule 'delete-guest-users' to run daily at 4:00 AM
-- Previous schedule was '0 * * * *' (Every hour)

SELECT cron.unschedule('delete-guest-users');

SELECT cron.schedule(
    'delete-guest-users',
    '0 4 * * *',  -- 4:00 AM daily
    $$SELECT delete_expired_guests()$$
);
