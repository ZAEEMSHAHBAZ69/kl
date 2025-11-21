/*
  # Enhance Technical Check Results Schema

  1. Enhanced `technical_check_results` table
    - Add granular component columns for individual metrics:
      - `ssl_score` (numeric) - SSL certificate validation score
      - `performance_score` (numeric) - Page performance score
      - `ads_txt_status` (text) - ads.txt file status
      - `broken_link_count` (integer) - Number of broken links detected
      - `domain_intelligence_rating` (text) - Domain intelligence severity
      - `viewport_occlusion_percentage` (numeric) - MFA viewport occlusion %
    - Add `component_recommendations` (jsonb) - Individual component fix recommendations
    - Add `health_score_previous` (numeric) - Previous health score for delta calculation
    - Add `components_data` (jsonb) - Complete component analysis details

  2. New `technical_check_history` table
    - Track version history and changes over time per publisher
    - Store health score deltas and change detection
    - Enable trend analysis and alerting

  3. Indexes and Security
    - Create indexes on publisher_id, site_audit_id, and timestamps
    - Enable RLS on history table
    - Add service role and authenticated user policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'technical_check_results' AND column_name = 'ssl_score'
  ) THEN
    ALTER TABLE technical_check_results ADD COLUMN ssl_score numeric DEFAULT NULL;
    ALTER TABLE technical_check_results ADD COLUMN performance_score numeric DEFAULT NULL;
    ALTER TABLE technical_check_results ADD COLUMN ads_txt_status text DEFAULT NULL;
    ALTER TABLE technical_check_results ADD COLUMN broken_link_count integer DEFAULT NULL;
    ALTER TABLE technical_check_results ADD COLUMN domain_intelligence_rating text DEFAULT NULL;
    ALTER TABLE technical_check_results ADD COLUMN viewport_occlusion_percentage numeric DEFAULT NULL;
    ALTER TABLE technical_check_results ADD COLUMN component_recommendations jsonb DEFAULT NULL;
    ALTER TABLE technical_check_results ADD COLUMN health_score_previous numeric DEFAULT NULL;
    ALTER TABLE technical_check_results ADD COLUMN components_data jsonb DEFAULT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS technical_check_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_audit_id uuid REFERENCES site_audits(id) ON DELETE CASCADE,
  publisher_id uuid REFERENCES publishers(id) ON DELETE SET NULL,
  technical_check_result_id uuid REFERENCES technical_check_results(id) ON DELETE CASCADE,
  previous_health_score numeric DEFAULT NULL,
  current_health_score numeric,
  health_score_delta numeric,
  detected_changes text[] DEFAULT ARRAY[]::text[],
  component_changes jsonb DEFAULT NULL,
  performance_degradation_detected boolean DEFAULT false,
  ssl_certificate_issues jsonb DEFAULT NULL,
  comparison_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_technical_check_history_site_audit_id ON technical_check_history(site_audit_id);
CREATE INDEX IF NOT EXISTS idx_technical_check_history_publisher_id ON technical_check_history(publisher_id);
CREATE INDEX IF NOT EXISTS idx_technical_check_history_timestamp ON technical_check_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_technical_check_history_health_score ON technical_check_history(current_health_score);

ALTER TABLE technical_check_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage technical check history"
  ON technical_check_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view technical check history"
  ON technical_check_history
  FOR SELECT
  TO authenticated
  USING (true);