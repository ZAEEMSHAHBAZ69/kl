/*
  # Add site_audit_id to content_analysis_results
  
  Adds a foreign key to site_audits table to link analysis results to specific audits.
  This enables proper tracing and querying of analysis data per audit.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content_analysis_results' AND column_name = 'site_audit_id'
  ) THEN
    ALTER TABLE content_analysis_results 
    ADD COLUMN site_audit_id uuid REFERENCES site_audits(id) ON DELETE CASCADE;
    
    CREATE INDEX idx_content_analysis_site_audit_id ON content_analysis_results(site_audit_id);
  END IF;
END $$;
