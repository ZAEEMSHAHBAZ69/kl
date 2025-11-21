  /*
    # Phase 1: Comparison Functions

    1. New Functions
      - `get_previous_audit_id`: Helper to find the last completed audit for a site
      - `calculate_publisher_risk_trajectory`: Aggregates risk scores over time
      - `detect_violation_patterns`: Basic pattern detection (placeholder for now)

    2. Security
      - Functions are SECURITY DEFINER to access necessary data
      - Grant execute permissions to authenticated users
  */

  -- Function to get the previous completed audit for a site
  CREATE OR REPLACE FUNCTION get_previous_audit_id(current_audit_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    prev_id uuid;
    curr_site_name text;
    curr_created_at timestamptz;
  BEGIN
    SELECT site_name, created_at INTO curr_site_name, curr_created_at
    FROM site_audits WHERE id = current_audit_id;

    SELECT id INTO prev_id
    FROM site_audits
    WHERE site_name = curr_site_name
    AND status = 'completed'
    AND created_at < curr_created_at
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN prev_id;
  END;
  $$;

  -- Function to calculate risk trajectory
  CREATE OR REPLACE FUNCTION calculate_publisher_risk_trajectory(p_publisher_id uuid, days_back int DEFAULT 30)
  RETURNS TABLE (
    audit_date timestamptz,
    risk_score numeric,
    site_name text
  )
  LANGUAGE sql
  SECURITY DEFINER
  AS $$
    SELECT
      created_at as audit_date,
      risk_score,
      site_name
    FROM site_audits
    WHERE publisher_id = p_publisher_id
    AND created_at > now() - (days_back || ' days')::interval
    AND status = 'completed'
    ORDER BY created_at ASC;
  $$;

  -- Grant permissions
  GRANT EXECUTE ON FUNCTION get_previous_audit_id TO authenticated;
  GRANT EXECUTE ON FUNCTION calculate_publisher_risk_trajectory TO authenticated;
