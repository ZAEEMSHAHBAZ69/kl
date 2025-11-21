/*
  # Fix RLS policies for all audit tables

  1. Security Changes
    - Update audit_logs RLS to allow service role and authenticated users
    - Update site_audits RLS to allow service role writes and authenticated reads
    - Update audit_results RLS to allow service role writes and authenticated reads
    - Update audit_failures RLS to allow service role writes and authenticated reads
    
  2. Policy Details
    - Service role can perform all operations (needed for worker inserts)
    - Authenticated users can read audit data
    - Service role is used by backend workers, so no ownership check needed
    - All tables now have proper logging-compatible policies
*/

-- Drop existing policies on audit_logs
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON audit_logs;

-- Create new audit_logs policies
CREATE POLICY "Service role can write audit logs"
  ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read audit logs"
  ON audit_logs
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can read audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Drop existing policies on site_audits
DROP POLICY IF EXISTS "Authenticated users can view site audits" ON site_audits;
DROP POLICY IF EXISTS "Authenticated users can insert site audits" ON site_audits;
DROP POLICY IF EXISTS "Authenticated users can update site audits" ON site_audits;

-- Create new site_audits policies
CREATE POLICY "Service role can insert site audits"
  ON site_audits
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update site audits"
  ON site_audits
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can read site audits"
  ON site_audits
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can read site audits"
  ON site_audits
  FOR SELECT
  TO authenticated
  USING (true);

-- Drop existing policies on audit_results
DROP POLICY IF EXISTS "Authenticated users can view audit results" ON audit_results;
DROP POLICY IF EXISTS "Authenticated users can insert audit results" ON audit_results;

-- Create new audit_results policies
CREATE POLICY "Service role can insert audit results"
  ON audit_results
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read audit results"
  ON audit_results
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can read audit results"
  ON audit_results
  FOR SELECT
  TO authenticated
  USING (true);

-- Drop existing policies on audit_failures
DROP POLICY IF EXISTS "Authenticated users can view audit failures" ON audit_failures;
DROP POLICY IF EXISTS "Authenticated users can insert audit failures" ON audit_failures;

-- Create new audit_failures policies
CREATE POLICY "Service role can insert audit failures"
  ON audit_failures
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read audit failures"
  ON audit_failures
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can read audit failures"
  ON audit_failures
  FOR SELECT
  TO authenticated
  USING (true);
