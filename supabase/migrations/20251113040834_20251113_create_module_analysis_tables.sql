/*
  # Create Module-Specific Analysis Tables
  
  1. New Tables
    - `ad_analysis_results` for storing ad behavior analysis
      - `id` (uuid, primary key)
      - `site_audit_id` (uuid, foreign key to site_audits)
      - `publisher_id` (uuid, foreign key to publishers)
      - `analysis_data` (jsonb, complete ad analysis results)
      - `risk_score` (numeric, ad risk score)
      - `timestamp` (timestamptz, analysis timestamp)
      - `created_at` (timestamptz)
      
    - `technical_check_results` for storing technical health checks
      - `id` (uuid, primary key)
      - `site_audit_id` (uuid, foreign key to site_audits)
      - `publisher_id` (uuid, foreign key to publishers)
      - `check_data` (jsonb, complete technical check results)
      - `risk_score` (numeric, technical risk score)
      - `timestamp` (timestamptz, check timestamp)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on both tables
    - Add service role full access
    - Add authenticated user read access
  
  3. Indexes
    - Index on site_audit_id for fast lookups
    - Index on publisher_id for publisher filtering
    - Index on timestamp for sorting
*/

CREATE TABLE IF NOT EXISTS ad_analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  publisher_id uuid REFERENCES publishers(id) ON DELETE SET NULL,
  analysis_data jsonb,
  risk_score numeric DEFAULT 0,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_analysis_site_audit_id ON ad_analysis_results(site_audit_id);
CREATE INDEX IF NOT EXISTS idx_ad_analysis_publisher_id ON ad_analysis_results(publisher_id);
CREATE INDEX IF NOT EXISTS idx_ad_analysis_timestamp ON ad_analysis_results(timestamp DESC);

ALTER TABLE ad_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage ad analysis"
  ON ad_analysis_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view ad analysis"
  ON ad_analysis_results
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS technical_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  publisher_id uuid REFERENCES publishers(id) ON DELETE SET NULL,
  check_data jsonb,
  risk_score numeric DEFAULT 0,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_technical_check_site_audit_id ON technical_check_results(site_audit_id);
CREATE INDEX IF NOT EXISTS idx_technical_check_publisher_id ON technical_check_results(publisher_id);
CREATE INDEX IF NOT EXISTS idx_technical_check_timestamp ON technical_check_results(timestamp DESC);

ALTER TABLE technical_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage technical checks"
  ON technical_check_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view technical checks"
  ON technical_check_results
  FOR SELECT
  TO authenticated
  USING (true);
