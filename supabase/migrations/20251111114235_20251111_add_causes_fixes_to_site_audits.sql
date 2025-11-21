/*
  # Add causes and fixes columns to site_audits table

  1. Add Columns
    - `causes` (jsonb) - Structured causes for detected issues from scorer module
    - `fixes` (jsonb) - Structured fixes/recommendations from scorer module
    - `score_breakdown` (jsonb) - Detailed breakdown of how the final score was calculated
    
  2. Notes
    - Stores scoring analysis output from the monitoring worker scorer module
    - Allows displaying detailed explanations of why a score was assigned
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'causes'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN causes jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'fixes'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN fixes jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_audits' AND column_name = 'score_breakdown'
  ) THEN
    ALTER TABLE site_audits ADD COLUMN score_breakdown jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;