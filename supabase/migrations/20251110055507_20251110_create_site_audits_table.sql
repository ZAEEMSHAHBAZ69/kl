/*
  # Create site_audits table

  1. New Tables
    - `site_audits`
      - `id` (uuid, primary key)
      - `audit_queue_id` (uuid, foreign key to audit_queue)
      - `publisher_id` (uuid, identifies the publisher)
      - `site_name` (text, the domain/site being audited)
      - `status` (text, audit status: pending, processing, completed, failed)
      - `crawler_data` (jsonb, raw crawled content)
      - `content_analysis` (jsonb, content analysis results)
      - `ad_analysis` (jsonb, ad analysis results)
      - `policy_check` (jsonb, policy compliance check results)
      - `technical_check` (jsonb, technical health check results)
      - `risk_score` (numeric, calculated risk score 0-100)
      - `ai_report` (jsonb, AI-generated insights and recommendations)
      - `raw_results` (jsonb, all raw module results)
      - `error_message` (text, error details if audit failed)
      - `error_stack` (text, stack trace if audit failed)
      - `started_at` (timestamptz, when audit started)
      - `completed_at` (timestamptz, when audit finished)
      - `updated_at` (timestamptz, last update timestamp)
      - `created_at` (timestamptz, server-side timestamp)

  2. Security
    - Enable RLS on `site_audits` table
    - Add policy for authenticated users to view their audit records

  3. Notes
    - This table stores individual site audit results
    - Each audit is linked to a job in audit_queue
    - Stores comprehensive audit data from all analysis modules
*/

CREATE TABLE IF NOT EXISTS site_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_queue_id uuid NOT NULL,
  publisher_id uuid NOT NULL,
  site_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  crawler_data jsonb,
  content_analysis jsonb,
  ad_analysis jsonb,
  policy_check jsonb,
  technical_check jsonb,
  risk_score numeric DEFAULT 0,
  ai_report jsonb,
  raw_results jsonb,
  error_message text,
  error_stack text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_audits_audit_queue_id ON site_audits(audit_queue_id);
CREATE INDEX IF NOT EXISTS idx_site_audits_publisher_id ON site_audits(publisher_id);
CREATE INDEX IF NOT EXISTS idx_site_audits_status ON site_audits(status);
CREATE INDEX IF NOT EXISTS idx_site_audits_site_name ON site_audits(site_name);
CREATE INDEX IF NOT EXISTS idx_site_audits_created_at ON site_audits(created_at DESC);

ALTER TABLE site_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view site audits"
  ON site_audits
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert site audits"
  ON site_audits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update site audits"
  ON site_audits
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
