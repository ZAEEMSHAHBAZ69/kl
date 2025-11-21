/*
  # Add DELETE policies for report and audit tables

  1. Security
    - Add DELETE policies for service_role on all related tables
    - Allows admins to delete publisher data through service role
*/

CREATE POLICY "reports_daily service_role delete"
  ON reports_daily FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "reports_dimensional service_role delete"
  ON reports_dimensional FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "report_historical service_role delete"
  ON report_historical FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "alerts service_role delete"
  ON alerts FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "mfa_composite_scores service_role delete"
  ON mfa_composite_scores FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "site_audits service_role delete"
  ON site_audits FOR DELETE
  TO service_role
  USING (true);
