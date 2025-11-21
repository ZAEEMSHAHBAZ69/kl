/*
  # Create Ad-Analyzer Tracking Tables

  1. New Tables
    - ad_density_history: Track ad density percentage changes
    - auto_refresh_tracking: Store auto-refresh detection results
    - visibility_compliance: Track visibility compliance status
    - pattern_correlations: Store network analysis and correlations
    - ad_element_batch: Individual ad elements from batch analysis

  2. Security - RLS enabled with service role full access

  3. Indexes - Composite indexes for efficient queries
*/

CREATE TABLE IF NOT EXISTS ad_density_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  site_audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  density_percentage numeric DEFAULT 0,
  total_viewport_pixels bigint DEFAULT 0,
  total_ad_pixels bigint DEFAULT 0,
  compliance_status text DEFAULT 'unknown',
  viewport_width integer,
  viewport_height integer,
  version integer DEFAULT 1,
  audit_timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_density_pub_ts ON ad_density_history(publisher_id, audit_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ad_density_audit ON ad_density_history(site_audit_id);
CREATE INDEX IF NOT EXISTS idx_ad_density_version ON ad_density_history(version);

ALTER TABLE ad_density_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage ad density"
  ON ad_density_history FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view ad density"
  ON ad_density_history FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS auto_refresh_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  site_audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  auto_refresh_detected boolean DEFAULT false,
  refresh_count integer DEFAULT 0,
  refresh_intervals integer[],
  affected_ad_slots integer DEFAULT 0,
  risk_level text DEFAULT 'low',
  version integer DEFAULT 1,
  audit_timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_refresh_pub_ts ON auto_refresh_tracking(publisher_id, audit_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auto_refresh_audit ON auto_refresh_tracking(site_audit_id);
CREATE INDEX IF NOT EXISTS idx_auto_refresh_detected ON auto_refresh_tracking(auto_refresh_detected);

ALTER TABLE auto_refresh_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage auto refresh"
  ON auto_refresh_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view auto refresh"
  ON auto_refresh_tracking FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS visibility_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  site_audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  compliance_status text DEFAULT 'unknown',
  visible_ads_percentage numeric DEFAULT 0,
  visible_ads_count integer DEFAULT 0,
  hidden_ads_count integer DEFAULT 0,
  total_ads_count integer DEFAULT 0,
  recommendations text[],
  audit_timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visibility_pub_ts ON visibility_compliance(publisher_id, audit_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_visibility_audit ON visibility_compliance(site_audit_id);
CREATE INDEX IF NOT EXISTS idx_visibility_status ON visibility_compliance(compliance_status);

ALTER TABLE visibility_compliance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage visibility"
  ON visibility_compliance FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view visibility"
  ON visibility_compliance FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS pattern_correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  site_audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  network_diversity integer DEFAULT 0,
  detected_networks jsonb,
  suspicious_patterns integer DEFAULT 0,
  mfa_risk_score numeric DEFAULT 0,
  mfa_indicators jsonb,
  detected_anomalies jsonb,
  correlation_data jsonb,
  version integer DEFAULT 1,
  audit_timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pattern_corr_pub_ts ON pattern_correlations(publisher_id, audit_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_corr_audit ON pattern_correlations(site_audit_id);
CREATE INDEX IF NOT EXISTS idx_pattern_corr_mfa_risk ON pattern_correlations(mfa_risk_score DESC);

ALTER TABLE pattern_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage patterns"
  ON pattern_correlations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view patterns"
  ON pattern_correlations FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS ad_element_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  site_audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  element_index integer DEFAULT 0,
  element_id text,
  element_class text,
  width integer,
  height integer,
  is_visible boolean DEFAULT false,
  network_type text,
  risk_indicators jsonb,
  audit_timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_element_pub_ts ON ad_element_batch(publisher_id, audit_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ad_element_audit ON ad_element_batch(site_audit_id);
CREATE INDEX IF NOT EXISTS idx_ad_element_visibility ON ad_element_batch(is_visible);

ALTER TABLE ad_element_batch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage ad elements"
  ON ad_element_batch FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view ad elements"
  ON ad_element_batch FOR SELECT TO authenticated USING (true);
