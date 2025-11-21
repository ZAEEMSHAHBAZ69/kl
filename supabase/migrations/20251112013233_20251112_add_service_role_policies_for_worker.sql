/*
  # Add Service Role Policies for Monitoring Worker

  1. Service Role Access
    - Add policies allowing service_role to perform all operations on worker tables
    - Needed for monitoring worker to insert/update audit data
    - Service role is used by backend workers and edge functions

  2. Tables Updated
    - `audit_queue` - Service role full access (SELECT, INSERT, UPDATE, DELETE)
    - `site_audits` - Service role full access (SELECT, INSERT, UPDATE, DELETE)
    - `audit_results` - Service role full access (SELECT, INSERT, UPDATE, DELETE)
    - `audit_failures` - Service role full access (SELECT, INSERT, UPDATE, DELETE)
    - `db_operation_logs` - Service role full access (SELECT, INSERT, UPDATE, DELETE)
    - `publishers` - Service role SELECT and UPDATE for audit tracking

  3. Security Notes
    - Service role policies use USING (true) and WITH CHECK (true) because:
      - Service role should bypass RLS for backend operations
      - Worker needs unrestricted access to queue and audit data
    - User policies remain unchanged for frontend security
    - This allows monitoring worker to function while maintaining user-level RLS
*/

-- Audit Queue: Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_queue'
    AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON audit_queue
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Site Audits: Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'site_audits'
    AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON site_audits
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Audit Results: Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_results'
    AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON audit_results
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Audit Failures: Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_failures'
    AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON audit_failures
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- DB Operation Logs: Service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'db_operation_logs'
    AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
      ON db_operation_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Publishers: Service role can update last_audit_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'publishers'
    AND policyname = 'Service role can update audit tracking'
  ) THEN
    CREATE POLICY "Service role can update audit tracking"
      ON publishers
      FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
