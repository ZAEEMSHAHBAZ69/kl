/*
  # Phase 1: Database Schema & Comparative Analytics

  1. New Tables
    - `module_comparison_results`
      - Stores comparison snapshots between audits
      - Links to site_audits and publishers
    - `publisher_trend_alerts`
      - Tracks alert conditions for publishers
      - Supports different severities and statuses
    - `data_retention_policy_logs`
      - Tracks cleanup operations and retention enforcement

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users and admins
*/

-- Drop tables if they exist to ensure clean state (useful for development/retries)
DROP TABLE IF EXISTS module_comparison_results;
DROP TABLE IF EXISTS publisher_trend_alerts;
DROP TABLE IF EXISTS data_retention_policy_logs;

-- module_comparison_results
CREATE TABLE IF NOT EXISTS module_comparison_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  previous_audit_id uuid REFERENCES site_audits(id) ON DELETE SET NULL,
  publisher_id uuid NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  comparison_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_comparison_current_audit ON module_comparison_results(current_audit_id);
CREATE INDEX IF NOT EXISTS idx_module_comparison_previous_audit ON module_comparison_results(previous_audit_id);
CREATE INDEX IF NOT EXISTS idx_module_comparison_publisher_id ON module_comparison_results(publisher_id);
CREATE INDEX IF NOT EXISTS idx_module_comparison_created_at ON module_comparison_results(created_at DESC);

ALTER TABLE module_comparison_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view module comparisons"
  ON module_comparison_results
  FOR SELECT
  TO authenticated
  USING (true);

-- publisher_trend_alerts
CREATE TABLE IF NOT EXISTS publisher_trend_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_publisher_trend_alerts_publisher_id ON publisher_trend_alerts(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_trend_alerts_status ON publisher_trend_alerts(status);
CREATE INDEX IF NOT EXISTS idx_publisher_trend_alerts_created_at ON publisher_trend_alerts(created_at DESC);

ALTER TABLE publisher_trend_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view their own alerts"
  ON publisher_trend_alerts
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM publishers
      WHERE publishers.id = publisher_trend_alerts.publisher_id
      AND publishers.partner_id = auth.uid()
    ))
    OR
    ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin'::text, 'super_admin'::text]))
  );

CREATE POLICY "Admins can manage alerts"
  ON publisher_trend_alerts
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin'::text, 'super_admin'::text])
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin'::text, 'super_admin'::text])
  );

-- data_retention_policy_logs
CREATE TABLE IF NOT EXISTS data_retention_policy_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name text NOT NULL,
  records_deleted integer NOT NULL DEFAULT 0,
  execution_status text NOT NULL CHECK (execution_status IN ('success', 'failed', 'partial')),
  details jsonb DEFAULT '{}'::jsonb,
  executed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_logs_executed_at ON data_retention_policy_logs(executed_at DESC);

ALTER TABLE data_retention_policy_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view retention logs"
  ON data_retention_policy_logs
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin'::text, 'super_admin'::text])
  );
