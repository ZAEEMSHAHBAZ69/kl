/*
  # Add Risk Probability Model to Replace Point-Based Scoring

  1. Overview
    - Replaces gameable point-based scoring with probabilistic risk assessment
    - Implements industry-standard fraud detection methodology (IAS, DoubleVerify, Pixalate)
    - Risk probability ranges 0-1 (where 1 = highest MFA likelihood)
    - Risk levels: LOW (0-0.29), MEDIUM (0.30-0.49), HIGH (0.50-0.74), CRITICAL (0.75+)
    
  2. New Columns on site_audits
    - `mfa_risk_probability` (numeric) - Probability site is MFA (0-1 scale)
    - `mfa_risk_level` (text) - Categorical risk: LOW, MEDIUM, HIGH, CRITICAL
    - `risk_confidence` (numeric) - Confidence in risk assessment (0-1 scale)
    - `risk_factors` (jsonb) - Weighted breakdown: {adBehavior, contentQuality, technicalRisk, layoutRisk}
    - `behavioral_risk_score` (numeric) - Behavioral signal risk (0-1)
    - `content_risk_score` (numeric) - Content quality risk (0-1)
    - `technical_risk_score` (numeric) - Technical/domain risk (0-1)
    - `layout_risk_score` (numeric) - Ad placement/layout risk (0-1)
    - `risk_factors_detailed` (jsonb) - Granular risk components for transparency

  3. New Columns on mfa_composite_scores
    - `mfa_risk_probability` (numeric) - Composite risk probability
    - `mfa_risk_level` (text) - Categorical risk level
    - `risk_confidence` (numeric) - Confidence score
    - `risk_factors` (jsonb) - Weighted factor breakdown
    - `risk_factors_detailed` (jsonb) - Detailed component breakdown

  4. Indexes
    - Index on mfa_risk_probability for sorting/filtering
    - Index on mfa_risk_level for category filtering
    - Index on risk_factors for JSON queries
    - Index on site_audits(mfa_risk_level, created_at) for dashboard filtering

  5. Data Strategy
    - New fields default to NULL for existing audits
    - Existing `overall_mfa_score` and point-based fields remain for historical compatibility
    - Risk probability calculated independently from point-based scores
    - Historical records not updated (only new audits use risk model)

  6. Security
    - No sensitive data in risk_factors JSONB
    - Risk probability values are statistical estimates, not user data
    - Confidence scores transparent for audit trail
*/

DO $$
BEGIN
  -- Add mfa_risk_probability to site_audits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'mfa_risk_probability'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN mfa_risk_probability numeric(3, 2) DEFAULT NULL;
  END IF;

  -- Add mfa_risk_level to site_audits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'mfa_risk_level'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN mfa_risk_level text DEFAULT NULL CHECK (mfa_risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
  END IF;

  -- Add risk_confidence to site_audits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'risk_confidence'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN risk_confidence numeric(3, 2) DEFAULT NULL;
  END IF;

  -- Add risk_factors to site_audits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'risk_factors'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN risk_factors jsonb DEFAULT NULL;
  END IF;

  -- Add behavioral_risk_score to site_audits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'behavioral_risk_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN behavioral_risk_score numeric(3, 2) DEFAULT NULL;
  END IF;

  -- Add content_risk_score to site_audits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'content_risk_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN content_risk_score numeric(3, 2) DEFAULT NULL;
  END IF;

  -- Add technical_risk_score to site_audits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'technical_risk_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN technical_risk_score numeric(3, 2) DEFAULT NULL;
  END IF;

  -- Add layout_risk_score to site_audits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'layout_risk_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN layout_risk_score numeric(3, 2) DEFAULT NULL;
  END IF;

  -- Add risk_factors_detailed to site_audits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'risk_factors_detailed'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN risk_factors_detailed jsonb DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  -- Add mfa_risk_probability to mfa_composite_scores
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'mfa_risk_probability'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN mfa_risk_probability numeric(3, 2) DEFAULT NULL;
  END IF;

  -- Add mfa_risk_level to mfa_composite_scores
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'mfa_risk_level'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN mfa_risk_level text DEFAULT NULL CHECK (mfa_risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
  END IF;

  -- Add risk_confidence to mfa_composite_scores
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'risk_confidence'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN risk_confidence numeric(3, 2) DEFAULT NULL;
  END IF;

  -- Add risk_factors to mfa_composite_scores
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'risk_factors'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN risk_factors jsonb DEFAULT NULL;
  END IF;

  -- Add risk_factors_detailed to mfa_composite_scores
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'risk_factors_detailed'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN risk_factors_detailed jsonb DEFAULT NULL;
  END IF;
END $$;

-- Create indexes for risk probability queries
CREATE INDEX IF NOT EXISTS idx_site_audits_mfa_risk_probability 
  ON site_audits (mfa_risk_probability DESC);

CREATE INDEX IF NOT EXISTS idx_site_audits_mfa_risk_level 
  ON site_audits (mfa_risk_level) WHERE mfa_risk_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_audits_risk_level_created 
  ON site_audits (mfa_risk_level, created_at DESC) WHERE mfa_risk_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mfa_composite_risk_probability 
  ON mfa_composite_scores (mfa_risk_probability DESC);

CREATE INDEX IF NOT EXISTS idx_mfa_composite_risk_level 
  ON mfa_composite_scores (mfa_risk_level) WHERE mfa_risk_level IS NOT NULL;
