/*
  # Create AI Results table

  1. New Tables
    - `ai_analysis_results`
      - `id` (uuid, primary key)
      - `site_audit_id` (uuid, foreign key to site_audits)
      - `publisher_id` (uuid, foreign key to publishers)
      - `llm_response` (text, raw LLM response)
      - `interpretation` (jsonb, parsed interpretation of LLM response)
      - `risk_categorization` (text, PRIMARY_CATEGORY from interpretation)
      - `risk_level` (text, risk assessment level)
      - `timestamp` (timestamptz, when analysis was performed)
      - `metadata` (jsonb, model and prompt version info)
      - `created_at` (timestamptz, server timestamp)

  2. Security
    - Enable RLS on `ai_analysis_results` table
    - Add policy for authenticated users to view results
    - Add policy for service role to insert/update results

  3. Notes
    - Stores detailed AI analysis results per site audit
    - Linked to site_audits for traceability
    - Indexes on site_audit_id and publisher_id for fast queries
*/

CREATE TABLE IF NOT EXISTS ai_analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  publisher_id uuid REFERENCES publishers(id) ON DELETE SET NULL,
  llm_response text,
  interpretation jsonb,
  risk_categorization text,
  risk_level text,
  timestamp timestamptz NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_site_audit_id ON ai_analysis_results(site_audit_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_publisher_id ON ai_analysis_results(publisher_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_timestamp ON ai_analysis_results(timestamp DESC);

ALTER TABLE ai_analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage AI results"
  ON ai_analysis_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view AI results"
  ON ai_analysis_results
  FOR SELECT
  TO authenticated
  USING (true);