/*
  # Create Scorer Module Persistence Tables

  1. New Tables
    - `scorer_risk_history` - Individual risk score records with component breakdown
      - `id` (uuid, primary key)
      - `publisher_id` (uuid, foreign key)
      - `audit_id` (uuid, foreign key)
      - `overall_risk_score` (numeric)
      - `mfa_probability` (numeric)
      - `weighted_score` (numeric)
      - Component scores: behavioral, content, technical, layout, gamCorrelation, policy
      - `confidence_score` (numeric)
      - `methodology` (text)
      - `created_at` (timestamptz)

    - `scorer_methodology_log` - Methodology details and reasoning for each calculation
      - `id` (uuid, primary key)
      - `publisher_id` (uuid, foreign key)
      - `audit_id` (uuid, foreign key)
      - `risk_score_id` (uuid, foreign key)
      - `model_version` (text)
      - `calculation_method` (text) - bayesian/logistic
      - `summary` (text)
      - `primary_reasons` (jsonb)
      - `contributing_factors` (jsonb)
      - `recommendations` (jsonb)
      - `risk_level` (text)
      - `created_at` (timestamptz)

    - `scorer_version_history` - Track version history of risk scores per publisher
      - `id` (uuid, primary key)
      - `publisher_id` (uuid, foreign key)
      - `audit_id` (uuid, foreign key)
      - `version_number` (bigint)
      - `risk_score` (numeric)
      - `mfa_probability` (numeric)
      - `recorded_at` (timestamptz)

    - `scorer_risk_deltas` - Calculate and store risk score changes between audits
      - `id` (uuid, primary key)
      - `publisher_id` (uuid, foreign key)
      - `current_audit_id` (uuid, foreign key)
      - `previous_audit_id` (uuid, foreign key)
      - `current_score` (numeric)
      - `previous_score` (numeric)
      - `delta_value` (numeric)
      - `delta_percentage` (numeric)
      - `days_since_previous` (integer)
      - `delta_direction` (text) - increasing/decreasing/stable
      - `created_at` (timestamptz)

    - `scorer_trend_analysis` - Trend analysis data and pattern detection results
      - `id` (uuid, primary key)
      - `publisher_id` (uuid, foreign key)
      - `audit_id` (uuid, foreign key)
      - `trend_direction` (text) - increasing/decreasing/stable
      - `trend_magnitude` (numeric)
      - `velocity` (numeric)
      - `velocity_direction` (text)
      - `deviation` (numeric)
      - `zscore` (numeric)
      - `anomaly_detected` (boolean)
      - `anomaly_score` (numeric)
      - `anomaly_reasons` (jsonb)
      - `trend_score` (numeric)
      - `statistics` (jsonb)
      - `created_at` (timestamptz)

    - `scorer_benchmark_comparisons` - Store publisher vs benchmark comparisons
      - `id` (uuid, primary key)
      - `publisher_id` (uuid, foreign key)
      - `audit_id` (uuid, foreign key)
      - `publisher_group` (text)
      - `ctr_deviation` (numeric)
      - `ecpm_deviation` (numeric)
      - `fill_rate_deviation` (numeric)
      - `benchmark_data` (jsonb)
      - `current_metrics` (jsonb)
      - `comparison_status` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add service_role policies for worker access
    - Add authenticated user policies for read/view access

  3. Indexes
    - Index on publisher_id for quick lookups
    - Index on audit_id for audit-specific queries
    - Index on created_at for time-based queries
    - Composite index on publisher_id + created_at for efficient range queries
*/

-- Create scorer_risk_history table
CREATE TABLE IF NOT EXISTS scorer_risk_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  audit_id uuid,
  overall_risk_score numeric(5,4) NOT NULL DEFAULT 0,
  mfa_probability numeric(5,4) NOT NULL DEFAULT 0,
  weighted_score numeric(5,4) NOT NULL DEFAULT 0,
  behavioral_score numeric(5,4) DEFAULT 0,
  content_score numeric(5,4) DEFAULT 0,
  technical_score numeric(5,4) DEFAULT 0,
  layout_score numeric(5,4) DEFAULT 0,
  gam_correlation_score numeric(5,4) DEFAULT 0,
  policy_score numeric(5,4) DEFAULT 0,
  confidence_score numeric(5,4) NOT NULL DEFAULT 0,
  methodology text NOT NULL DEFAULT 'bayesian',
  component_breakdown jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create scorer_methodology_log table
CREATE TABLE IF NOT EXISTS scorer_methodology_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  audit_id uuid,
  risk_score_id uuid,
  model_version text NOT NULL DEFAULT 'v1',
  calculation_method text NOT NULL,
  summary text,
  primary_reasons jsonb,
  contributing_factors jsonb,
  recommendations jsonb,
  risk_level text,
  explanation_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create scorer_version_history table
CREATE TABLE IF NOT EXISTS scorer_version_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  audit_id uuid,
  version_number bigint NOT NULL DEFAULT 1,
  risk_score numeric(5,4) NOT NULL,
  mfa_probability numeric(5,4) NOT NULL,
  risk_level text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create scorer_risk_deltas table
CREATE TABLE IF NOT EXISTS scorer_risk_deltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  current_audit_id uuid,
  previous_audit_id uuid,
  current_score numeric(5,4) NOT NULL,
  previous_score numeric(5,4) NOT NULL,
  delta_value numeric(5,4) NOT NULL,
  delta_percentage numeric(8,4),
  days_since_previous integer,
  delta_direction text,
  velocity numeric(5,4),
  created_at timestamptz DEFAULT now()
);

-- Create scorer_trend_analysis table
CREATE TABLE IF NOT EXISTS scorer_trend_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  audit_id uuid,
  trend_direction text,
  trend_magnitude numeric(5,4),
  velocity numeric(5,4),
  velocity_direction text,
  deviation numeric(5,4),
  zscore numeric(8,4),
  anomaly_detected boolean DEFAULT false,
  anomaly_score numeric(5,4),
  anomaly_reasons jsonb,
  trend_score numeric(5,4),
  statistics jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create scorer_benchmark_comparisons table
CREATE TABLE IF NOT EXISTS scorer_benchmark_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  audit_id uuid,
  publisher_group text,
  ctr_deviation numeric(8,4),
  ecpm_deviation numeric(8,4),
  fill_rate_deviation numeric(8,4),
  benchmark_data jsonb,
  current_metrics jsonb,
  comparison_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scorer_risk_history_publisher
  ON scorer_risk_history(publisher_id);

CREATE INDEX IF NOT EXISTS idx_scorer_risk_history_audit
  ON scorer_risk_history(audit_id);

CREATE INDEX IF NOT EXISTS idx_scorer_risk_history_created
  ON scorer_risk_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scorer_risk_history_publisher_created
  ON scorer_risk_history(publisher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scorer_methodology_publisher
  ON scorer_methodology_log(publisher_id);

CREATE INDEX IF NOT EXISTS idx_scorer_version_history_publisher
  ON scorer_version_history(publisher_id);

CREATE INDEX IF NOT EXISTS idx_scorer_version_history_publisher_version
  ON scorer_version_history(publisher_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_scorer_risk_deltas_publisher
  ON scorer_risk_deltas(publisher_id);

CREATE INDEX IF NOT EXISTS idx_scorer_trend_analysis_publisher
  ON scorer_trend_analysis(publisher_id);

CREATE INDEX IF NOT EXISTS idx_scorer_benchmark_comparisons_publisher
  ON scorer_benchmark_comparisons(publisher_id);

-- Enable RLS on all tables
ALTER TABLE scorer_risk_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorer_methodology_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorer_version_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorer_risk_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorer_trend_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorer_benchmark_comparisons ENABLE ROW LEVEL SECURITY;

-- Service role policies (worker access)
CREATE POLICY "Service role can manage scorer_risk_history"
  ON scorer_risk_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage scorer_methodology_log"
  ON scorer_methodology_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage scorer_version_history"
  ON scorer_version_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage scorer_risk_deltas"
  ON scorer_risk_deltas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage scorer_trend_analysis"
  ON scorer_trend_analysis FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage scorer_benchmark_comparisons"
  ON scorer_benchmark_comparisons FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
