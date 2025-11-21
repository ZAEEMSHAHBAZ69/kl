/*
  # Create MFA Risk Scores and Publisher Trend Tables

  1. New Tables
    - `mfa_risk_scores`
      - `id` (uuid, primary key)
      - `audit_id` (uuid, references the audit)
      - `domain` (text, domain being audited)
      - `fraud_probability` (numeric, MFA probability score 0-1)
      - `confidence_level` (numeric, confidence in the score)
      - `risk_factors` (jsonb, component risk breakdown)
      - `reasoning` (jsonb, explanation of score)
      - `model_version` (text, version of risk model)
      - `created_at` (timestamptz, when score was created)

    - `publisher_risk_trends`
      - `id` (uuid, primary key)
      - `publisher_id` (uuid, identifies publisher)
      - `site_url` (text, site being monitored)
      - `mfa_probability` (numeric, current MFA probability)
      - `trend_direction` (text, up/down/stable)
      - `velocity` (numeric, rate of change)
      - `previous_mfa_probability` (numeric, previous score)
      - `days_since_previous` (integer, days between measurements)
      - `probability_change` (numeric, absolute change in probability)
      - `ctr_deviation` (numeric, CTR deviation from benchmark)
      - `ctr_vs_benchmark` (text, comparison to benchmark)
      - `ecpm_deviation` (numeric, ECPM deviation from benchmark)
      - `ecpm_vs_benchmark` (text, comparison to benchmark)
      - `fill_rate_change` (numeric, fill rate change)
      - `is_anomaly` (boolean, whether anomaly detected)
      - `anomaly_score` (numeric, anomaly confidence)
      - `anomaly_reasons` (jsonb, why it's anomalous)
      - `created_at` (timestamptz, when trend was recorded)

  2. Security
    - Enable RLS on both tables
    - Add policies for service role to insert/read

  3. Indexes
    - Index on audit_id for quick lookups
    - Index on publisher_id for trend analysis
    - Index on created_at for time-series queries
*/

CREATE TABLE IF NOT EXISTS mfa_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid,
  domain text,
  fraud_probability numeric DEFAULT 0,
  confidence_level numeric DEFAULT 0,
  risk_factors jsonb,
  reasoning jsonb,
  model_version text DEFAULT 'risk-probability-model-v1',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_risk_scores_audit_id ON mfa_risk_scores(audit_id);
CREATE INDEX IF NOT EXISTS idx_mfa_risk_scores_domain ON mfa_risk_scores(domain);
CREATE INDEX IF NOT EXISTS idx_mfa_risk_scores_created_at ON mfa_risk_scores(created_at DESC);

ALTER TABLE mfa_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage risk scores"
  ON mfa_risk_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read risk scores"
  ON mfa_risk_scores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS publisher_risk_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  site_url text,
  mfa_probability numeric DEFAULT 0,
  trend_direction text,
  velocity numeric DEFAULT 0,
  previous_mfa_probability numeric,
  days_since_previous integer,
  probability_change numeric,
  ctr_deviation numeric,
  ctr_vs_benchmark text,
  ecpm_deviation numeric,
  ecpm_vs_benchmark text,
  fill_rate_change numeric,
  is_anomaly boolean DEFAULT false,
  anomaly_score numeric,
  anomaly_reasons jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publisher_risk_trends_publisher_id ON publisher_risk_trends(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_risk_trends_site_url ON publisher_risk_trends(site_url);
CREATE INDEX IF NOT EXISTS idx_publisher_risk_trends_created_at ON publisher_risk_trends(created_at DESC);

ALTER TABLE publisher_risk_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage risk trends"
  ON publisher_risk_trends
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read risk trends"
  ON publisher_risk_trends
  FOR SELECT
  TO authenticated
  USING (true);
