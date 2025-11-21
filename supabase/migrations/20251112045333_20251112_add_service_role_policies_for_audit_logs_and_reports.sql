/*
  # Add Service Role Policies for audit_logs and reports_dimensional

  1. Tables Updated
    - `audit_logs` - Add INSERT policy for service_role to write logs from worker
    - `reports_dimensional` - Add INSERT policy for service_role to write report data

  2. Security Notes
    - Service role policies use WITH CHECK (true) for INSERT operations
    - This allows monitoring workers and edge functions to write data
    - User-level SELECT policies remain unchanged for frontend security
    - Service role bypass is necessary for backend worker operations
*/

-- audit_logs: Service role INSERT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs'
    AND policyname = 'Service role can insert audit logs'
  ) THEN
    CREATE POLICY "Service role can insert audit logs"
      ON audit_logs
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- reports_dimensional: Service role INSERT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reports_dimensional'
    AND policyname = 'Service role can insert reports'
  ) THEN
    CREATE POLICY "Service role can insert reports"
      ON reports_dimensional
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;
