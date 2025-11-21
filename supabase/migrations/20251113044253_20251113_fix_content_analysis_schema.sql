/*
  # Fix content_analysis_results schema

  1. Ensure publisher_id column exists
  2. Add missing columns if needed
  3. Refresh schema cache
  
  This migration ensures the content_analysis_results table has all required
  columns properly defined and the schema is synchronized.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_analysis_results' AND column_name = 'publisher_id'
  ) THEN
    ALTER TABLE content_analysis_results ADD COLUMN publisher_id uuid NOT NULL DEFAULT gen_random_uuid();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_analysis_results' AND column_name = 'site_audit_id'
  ) THEN
    ALTER TABLE content_analysis_results 
    ADD COLUMN site_audit_id uuid REFERENCES site_audits(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_content_analysis_site_audit_id ON content_analysis_results(site_audit_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_analysis_publisher ON content_analysis_results(publisher_id);

NOTIFY pgrst, 'reload schema';