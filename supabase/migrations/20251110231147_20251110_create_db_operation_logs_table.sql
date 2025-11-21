/*
  # Create database operation logs table

  1. New Tables
    - `db_operation_logs`
      - `id` (uuid, primary key)
      - `timestamp` (timestamptz, when the operation occurred)
      - `level` (text, log level: INFO, WARN, ERROR)
      - `operation` (text, operation type: INSERT, UPDATE, SELECT, DELETE)
      - `table_name` (text, which table the operation was on)
      - `status` (text, success or failure)
      - `message` (text, human-readable message)
      - `details` (jsonb, additional operation details)
      - `error_message` (text, error details if failed)
      - `duration_ms` (integer, how long the operation took)
      - `record_count` (integer, how many records affected)
      - `created_at` (timestamptz, server-side timestamp)

  2. Security
    - Enable RLS on `db_operation_logs` table
    - Add policy for service role to write logs
    - Add policy for authenticated users to read logs

  3. Indexes
    - Index on timestamp for efficient querying
    - Index on operation type for filtering
    - Index on table_name for filtering by table
    - Index on status for quick failure detection
*/

CREATE TABLE IF NOT EXISTS db_operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL,
  level text NOT NULL,
  operation text NOT NULL,
  table_name text,
  status text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  error_message text,
  duration_ms integer,
  record_count integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_db_operation_logs_timestamp ON db_operation_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_db_operation_logs_operation ON db_operation_logs(operation);
CREATE INDEX IF NOT EXISTS idx_db_operation_logs_table_name ON db_operation_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_db_operation_logs_status ON db_operation_logs(status);
CREATE INDEX IF NOT EXISTS idx_db_operation_logs_level ON db_operation_logs(level);

ALTER TABLE db_operation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert operation logs"
  ON db_operation_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read operation logs"
  ON db_operation_logs
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can read operation logs"
  ON db_operation_logs
  FOR SELECT
  TO authenticated
  USING (true);
