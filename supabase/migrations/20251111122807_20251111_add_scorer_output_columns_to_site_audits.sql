/*
  # Add Scorer Output Columns to site_audits

  1. New Columns on site_audits
    - `score_breakdown` (jsonb) - Component scores (behavioral, content, technical, etc.)
    - `mfa_probability` (numeric) - MFA/fraud probability score (0-100)
    - `risk_level` (text) - Risk categorization (MINIMAL, LOW, MEDIUM, HIGH, CRITICAL)
    - `methodology` (text) - Scoring methodology used
    - `primary_causes` (jsonb) - Array of primary risk factors causing the score
    - `contributing_factors` (jsonb) - Array of contributing risk factors
    - `recommendations` (jsonb) - Array of actionable recommendations/fixes
    - `trend_data` (jsonb) - Historical trend information
    - `explanation_details` (jsonb) - Full explanation object with summary and details
    - `confidence_score` (numeric) - Confidence level of the score (0-1)
    - `explanation_timestamp` (timestamptz) - When explanation was generated

  2. Notes
    - All new columns are optional (nullable) for backward compatibility
    - Stores complete scorer output for audit review and analytics
    - Index on risk_level for fast filtering
    - Enables detailed risk analysis and audit trail

  3. Indexes
    - idx_site_audits_risk_level - For dashboard filtering by risk
    - idx_site_audits_mfa_probability - For MFA trend analysis
*/

DO $$
BEGIN
  -- Add score_breakdown column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'score_breakdown'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN score_breakdown jsonb DEFAULT NULL;
  END IF;

  -- Add mfa_probability column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'mfa_probability'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN mfa_probability numeric(5, 2) DEFAULT NULL;
  END IF;

  -- Add risk_level column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'risk_level'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN risk_level text DEFAULT NULL 
      CHECK (risk_level IS NULL OR risk_level IN ('MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
  END IF;

  -- Add methodology column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'methodology'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN methodology text DEFAULT NULL;
  END IF;

  -- Add primary_causes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'primary_causes'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN primary_causes jsonb DEFAULT NULL;
  END IF;

  -- Add contributing_factors column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'contributing_factors'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN contributing_factors jsonb DEFAULT NULL;
  END IF;

  -- Add recommendations column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'recommendations'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN recommendations jsonb DEFAULT NULL;
  END IF;

  -- Add trend_data column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'trend_data'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN trend_data jsonb DEFAULT NULL;
  END IF;

  -- Add explanation_details column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'explanation_details'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN explanation_details jsonb DEFAULT NULL;
  END IF;

  -- Add confidence_score column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN confidence_score numeric(3, 2) DEFAULT NULL;
  END IF;

  -- Add explanation_timestamp column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'explanation_timestamp'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN explanation_timestamp timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_site_audits_risk_level 
  ON site_audits(risk_level) WHERE risk_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_audits_mfa_probability 
  ON site_audits(mfa_probability DESC NULLS LAST) WHERE mfa_probability IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_audits_confidence 
  ON site_audits(confidence_score DESC NULLS LAST) WHERE confidence_score IS NOT NULL;
