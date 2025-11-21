/*
  # Setup pg_cron for Scheduled Daily Audits

  1. Enable pg_cron extension
    - Required for scheduling cron jobs in PostgreSQL

  2. Create cron job for daily audits at 2 AM
    - Schedule: '0 2 * * *' (2 AM UTC every day)
    - Task: Call scheduled-all-audits-cron edge function via HTTP request

  3. Notes
    - pg_cron runs as background job
    - Edge function will be called with Service Role Key
    - Logs written to cron_execution_logs table
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job to trigger audits daily at 2 AM UTC
-- Note: If a job with this name already exists, this will update it
SELECT cron.schedule(
  'scheduled-audits-daily',
  '0 2 * * *',
  $$
    SELECT
      net.http_post(
        url := 'https://' || current_setting('app.supabase_url', true) || '/functions/v1/scheduled-all-audits-cron',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
          'trigger', 'pg_cron'
        )
      ) as request_id;
  $$
);

-- Comment explaining the cron job
COMMENT ON EXTENSION pg_cron IS 'Enables pg_cron for scheduling database jobs';
