/*
  # Enhance Cron Execution Tables for Scheduled Audits

  1. Modifications to cron_execution_logs
    - Add request_id column for tracking cron-${timestamp} format
    - Add started_at, completed_at, next_scheduled_time columns
    - Add execution_status, error_message columns
    - Add queued_count, skipped_count columns

  2. Modifications to audit_failures
    - Add reason column for circuit breaker logic

  3. Security
    - Maintain existing RLS policies
    - Service role continues to have full access
*/

-- Add missing columns to cron_execution_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cron_execution_logs' AND column_name = 'request_id'
  ) THEN
    ALTER TABLE cron_execution_logs ADD COLUMN request_id text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cron_execution_logs' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE cron_execution_logs ADD COLUMN started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cron_execution_logs' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE cron_execution_logs ADD COLUMN completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cron_execution_logs' AND column_name = 'next_scheduled_time'
  ) THEN
    ALTER TABLE cron_execution_logs ADD COLUMN next_scheduled_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cron_execution_logs' AND column_name = 'execution_status'
  ) THEN
    ALTER TABLE cron_execution_logs ADD COLUMN execution_status text CHECK (execution_status IN ('success', 'partial', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cron_execution_logs' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE cron_execution_logs ADD COLUMN error_message text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cron_execution_logs' AND column_name = 'queued_count'
  ) THEN
    ALTER TABLE cron_execution_logs ADD COLUMN queued_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cron_execution_logs' AND column_name = 'skipped_count'
  ) THEN
    ALTER TABLE cron_execution_logs ADD COLUMN skipped_count integer DEFAULT 0;
  END IF;
END $$;

-- Add missing columns to audit_failures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'audit_failures' AND column_name = 'reason'
  ) THEN
    ALTER TABLE audit_failures ADD COLUMN reason text;
  END IF;
END $$;

-- Create indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_cron_execution_logs_request_id ON cron_execution_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_cron_execution_logs_started_at ON cron_execution_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_failures_publisher_id_failure_timestamp ON audit_failures(publisher_id, failure_timestamp DESC);
