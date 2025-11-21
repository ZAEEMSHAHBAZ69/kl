/*
  # Create site_audits table for batch site audit results

  1. New Tables
    - `site_audits`: Stores individual site audit results from batch processing
      - Links to audit_queue (batch job) and publishers
      - Stores site-specific metrics and module outputs
      - Tracks status: pending, processing, completed, failed
*/

DROP TABLE IF EXISTS site_audits CASCADE;

CREATE TABLE site_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_queue_id uuid NOT NULL REFERENCES audit_queue(id) ON DELETE CASCADE,
  publisher_id uuid NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  site_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  crawler_data jsonb,
  content_analysis jsonb,
  ad_analysis jsonb,
  policy_check jsonb,
  technical_check jsonb,
  risk_score numeric(5, 2) DEFAULT 0,
  ai_report jsonb,
  
  raw_results jsonb,
  error_message text,
  error_stack text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_site_audits_queue_site ON site_audits(audit_queue_id, site_name);
CREATE INDEX idx_site_audits_publisher_site ON site_audits(publisher_id, site_name);
CREATE INDEX idx_site_audits_status ON site_audits(status);
CREATE INDEX idx_site_audits_created ON site_audits(created_at DESC);
CREATE INDEX idx_site_audits_queue ON site_audits(audit_queue_id);

ALTER TABLE site_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage site_audits"
  ON site_audits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

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
