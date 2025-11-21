/*
  # Database Schema Consolidation and Cleanup

  1. Overview
    - Consolidates audit data from audit_results into site_audits
    - Removes duplicate audit_results table to prevent confusion
    - Enhances mfa_composite_scores with data integrity and quality tracking
    - Adds comprehensive performance indexes
    - Ensures complete RLS policy coverage

  2. Phase 1: Enhance site_audits
    - Verify all required score and analysis fields exist
    - Add missing columns: safety_check, ai_analysis_summary
    - Add comprehensive score fields: seo_score, performance_score, security_score, etc.

  3. Phase 2: Migrate audit_results to site_audits
    - Copy all data from audit_results to site_audits
    - Handle timestamp mapping (audit_timestamp → created_at)
    - Preserve audit_type information

  4. Phase 3: Enhance mfa_composite_scores
    - Add data_completeness (text: '100%', 'partial', 'minimal')
    - Add gam_data_timestamp, audit_data_timestamp (timestamptz)
    - Add ai_analysis_status (text: 'completed', 'degraded', 'failed')
    - Add is_stale (boolean), staleness_reason (text)
    - Add weighted_score_breakdown (jsonb)
    - Add model_confidence_scores (jsonb)

  5. Phase 4: Performance Optimization
    - Create indexes for common queries
    - Optimize RLS policies for performance
    - Add strategic indexes on foreign keys

  6. Phase 5: Cleanup
    - Drop audit_results table
    - Drop related policies and indexes

  7. Security
    - All tables have RLS enabled
    - Service role has full access for background workers
    - Authenticated users can only access their own publisher data
*/

-- ===== PHASE 1: Enhance site_audits with missing columns =====

DO $$
BEGIN
  -- Add safety_check if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'safety_check'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN safety_check jsonb DEFAULT NULL;
  END IF;

  -- Add ai_analysis_summary if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'ai_analysis_summary'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN ai_analysis_summary jsonb DEFAULT NULL;
  END IF;

  -- Add comprehensive score fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'seo_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN seo_score numeric(5, 2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'performance_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN performance_score numeric(5, 2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'security_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN security_score numeric(5, 2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'accessibility_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN accessibility_score numeric(5, 2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'policy_compliance_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN policy_compliance_score numeric(5, 2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'ad_density'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN ad_density numeric(5, 2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'content_uniqueness'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN content_uniqueness numeric(5, 2) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'site_audits' AND column_name = 'overall_quality_score'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN overall_quality_score numeric(5, 2) DEFAULT NULL;
  END IF;
END $$;

-- ===== PHASE 2: Migrate data from audit_results to site_audits =====

-- Only migrate if audit_results has data and site_audits doesn't have equivalent data
DO $$
DECLARE
  audit_results_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO audit_results_count FROM audit_results;
  
  IF audit_results_count > 0 THEN
    INSERT INTO site_audits (
      id, audit_queue_id, publisher_id, site_name, site_url, status,
      crawler_data, content_analysis, ad_analysis, policy_check, technical_check,
      risk_score, ai_report, raw_results, created_at, updated_at
    )
    SELECT 
      ar.id,
      aq.id as audit_queue_id,
      ar.publisher_id,
      COALESCE(ar.audit_type, 'full_site_audit') as site_name,
      NULL as site_url,
      'completed' as status,
      ar.crawler_data,
      ar.content_analysis,
      ar.ad_analysis,
      ar.policy_check,
      ar.technical_check,
      ar.risk_score,
      ar.ai_report,
      ar.raw_results,
      COALESCE(ar.audit_timestamp, ar.created_at) as created_at,
      COALESCE(ar.audit_timestamp, ar.created_at) as updated_at
    FROM audit_results ar
    LEFT JOIN audit_queue aq ON aq.publisher_id = ar.publisher_id 
      AND aq.completed_at >= ar.audit_timestamp - INTERVAL '1 hour'
      AND aq.completed_at <= ar.audit_timestamp + INTERVAL '1 hour'
    WHERE NOT EXISTS (
      SELECT 1 FROM site_audits sa 
      WHERE sa.id = ar.id
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ===== PHASE 3: Enhance mfa_composite_scores with data integrity columns =====

DO $$
BEGIN
  -- Add data_completeness if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'data_completeness'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN data_completeness text 
      DEFAULT '100%' CHECK (data_completeness IN ('100%', 'partial', 'minimal'));
  END IF;

  -- Add gam_data_timestamp if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'gam_data_timestamp'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN gam_data_timestamp timestamptz DEFAULT NULL;
  END IF;

  -- Add audit_data_timestamp if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'audit_data_timestamp'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN audit_data_timestamp timestamptz DEFAULT NULL;
  END IF;

  -- Add ai_analysis_status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'ai_analysis_status'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN ai_analysis_status text 
      DEFAULT 'completed' CHECK (ai_analysis_status IN ('completed', 'degraded', 'failed'));
  END IF;

  -- Add is_stale if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'is_stale'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN is_stale boolean DEFAULT false;
  END IF;

  -- Add staleness_reason if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'staleness_reason'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN staleness_reason text DEFAULT NULL;
  END IF;

  -- Add weighted_score_breakdown if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'weighted_score_breakdown'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN weighted_score_breakdown jsonb DEFAULT NULL;
  END IF;

  -- Add model_confidence_scores if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mfa_composite_scores' AND column_name = 'model_confidence_scores'
  ) THEN
    ALTER TABLE mfa_composite_scores ADD COLUMN model_confidence_scores jsonb DEFAULT NULL;
  END IF;
END $$;

-- ===== PHASE 4: Create performance indexes =====

-- Indexes for site_audits
CREATE INDEX IF NOT EXISTS idx_site_audits_publisher_created 
  ON site_audits(publisher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_audits_status_created 
  ON site_audits(status, created_at DESC) WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_site_audits_audit_queue 
  ON site_audits(audit_queue_id);

CREATE INDEX IF NOT EXISTS idx_site_audits_site_name 
  ON site_audits(site_name);

-- Indexes for mfa_composite_scores
CREATE INDEX IF NOT EXISTS idx_mfa_composite_publisher 
  ON mfa_composite_scores(publisher_id);

CREATE INDEX IF NOT EXISTS idx_mfa_composite_data_freshness 
  ON mfa_composite_scores(is_stale, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_mfa_composite_ai_status 
  ON mfa_composite_scores(ai_analysis_status) WHERE ai_analysis_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mfa_composite_timestamps 
  ON mfa_composite_scores(gam_data_timestamp, audit_data_timestamp);

-- ===== PHASE 5: Verify and optimize RLS policies =====

-- Remove old audit_results policies if they exist
DROP POLICY IF EXISTS "Service role can manage audit results" ON audit_results;
DROP POLICY IF EXISTS "Authenticated users can view audit results for their publishers" ON audit_results;

-- Ensure site_audits has service role access
DROP POLICY IF EXISTS "Service role can manage site_audits" ON site_audits;
CREATE POLICY "Service role can manage site_audits"
  ON site_audits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure site_audits has authenticated user access
DROP POLICY IF EXISTS "Authenticated users can view site_audits for their publishers" ON site_audits;
CREATE POLICY "Authenticated users can view site_audits for their publishers"
  ON site_audits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM publishers
      WHERE publishers.id = site_audits.publisher_id
      AND publishers.created_by = auth.uid()
    )
  );

-- Ensure mfa_composite_scores has RLS enabled
ALTER TABLE mfa_composite_scores ENABLE ROW LEVEL SECURITY;

-- Drop old mfa_composite_scores policies if they exist
DROP POLICY IF EXISTS "Service role can manage mfa_composite_scores" ON mfa_composite_scores;
DROP POLICY IF EXISTS "Authenticated users can view mfa_composite_scores for their publishers" ON mfa_composite_scores;

-- Add new mfa_composite_scores policies
CREATE POLICY "Service role can manage mfa_composite_scores"
  ON mfa_composite_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view mfa_composite_scores for their publishers"
  ON mfa_composite_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM publishers
      WHERE publishers.id = mfa_composite_scores.publisher_id
      AND publishers.created_by = auth.uid()
    )
  );

-- ===== PHASE 6: Cleanup - Drop audit_results table =====

-- Drop old indexes on audit_results if they exist
DROP INDEX IF EXISTS idx_audit_results_publisher;
DROP INDEX IF EXISTS idx_audit_results_timestamp;

-- Drop audit_results table and associated objects
DROP TABLE IF EXISTS audit_results CASCADE;
