/*
  # Add Causes and Fixes to Audit Results
  
  1. Add Columns
    - `causes` (jsonb) - Structured causes for detected issues
    - `fixes` (jsonb) - Structured fixes/recommendations
    - `ai_analysis` (jsonb) - Full AI analysis response
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_results' AND column_name = 'causes'
  ) THEN
    ALTER TABLE audit_results ADD COLUMN causes jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_results' AND column_name = 'fixes'
  ) THEN
    ALTER TABLE audit_results ADD COLUMN fixes jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_results' AND column_name = 'ai_analysis'
  ) THEN
    ALTER TABLE audit_results ADD COLUMN ai_analysis jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
