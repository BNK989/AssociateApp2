-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup function to run every hour
-- NOTE: You must replace <SERVICE_ROLE_KEY> with your actual service role key
-- and ensure the project URL is correct.
SELECT cron.schedule(
  'cleanup-games-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
      url:='https://vynlmerpppyyyqkatwej.supabase.co/functions/v1/cleanup-games',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb
  ) as request_id;
  $$
);
