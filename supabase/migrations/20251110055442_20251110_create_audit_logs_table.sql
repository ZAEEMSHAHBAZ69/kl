/*
  # Create audit_logs table

  1. New Tables
    - `audit_logs`
      - `id` (uuid, primary key)
      - `timestamp` (timestamptz, when the log was created)
      - `level` (text, log level: DEBUG, INFO, WARN, ERROR)
      - `message` (text, log message)
      - `context` (jsonb, contextual information about the log)
      - `error` (text, error message if applicable)
      - `user_id` (uuid, optional user ID)
      - `publisher_id` (uuid, optional publisher ID)
      - `created_at` (timestamptz, server-side timestamp)

  2. Security
    - Enable RLS on `audit_logs` table
    - Add policy for authenticated users to view logs (basic read access)

  3. Notes
    - This table stores all audit logs from the worker processes
    - The `context` field stores structured contextual data as JSON
*/

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL,
  level text NOT NULL,
  message text NOT NULL,
  context jsonb,
  error text,
  user_id uuid,
  publisher_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_level ON audit_logs(level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_publisher_id ON audit_logs(publisher_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);
