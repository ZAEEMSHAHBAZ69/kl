/*
  # Create audit_results and audit_failures tables

  1. New Tables
    - `audit_results`
      - `id` (uuid, primary key)
      - `publisher_id` (uuid, identifies the publisher)
      - `audit_type` (text, type of audit performed)
      - `crawler_data` (jsonb, crawled page data)
      - `content_analysis` (jsonb, content analysis results)
      - `ad_analysis` (jsonb, ad performance analysis)
      - `policy_check` (jsonb, policy compliance results)
      - `technical_check` (jsonb, technical health metrics)
      - `risk_score` (numeric, overall risk score)
      - `ai_report` (jsonb, AI insights and recommendations)
      - `audit_timestamp` (timestamptz, when audit was performed)
      - `raw_results` (jsonb, all raw module outputs)
      - `created_at` (timestamptz, server-side timestamp)

    - `audit_failures`
      - `id` (uuid, primary key)
      - `publisher_id` (uuid, identifies the publisher)
      - `module` (text, which module failed)
      - `error_message` (text, error details)
      - `error_stack` (text, full stack trace)
      - `failure_timestamp` (timestamptz, when failure occurred)
      - `request_id` (text, request ID for tracing)
      - `created_at` (timestamptz, server-side timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to access records

  3. Notes
    - audit_results stores the final outputs of successful audits
    - audit_failures logs errors for debugging and monitoring
*/

CREATE TABLE IF NOT EXISTS audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  audit_type text NOT NULL,
  crawler_data jsonb,
  content_analysis jsonb,
  ad_analysis jsonb,
  policy_check jsonb,
  technical_check jsonb,
  risk_score numeric DEFAULT 0,
  ai_report jsonb,
  audit_timestamp timestamptz NOT NULL,
  raw_results jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_results_publisher_id ON audit_results(publisher_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_audit_timestamp ON audit_results(audit_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_results_created_at ON audit_results(created_at DESC);

ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit results"
  ON audit_results
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit results"
  ON audit_results
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS audit_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  module text NOT NULL,
  error_message text NOT NULL,
  error_stack text,
  failure_timestamp timestamptz NOT NULL,
  request_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_failures_publisher_id ON audit_failures(publisher_id);
CREATE INDEX IF NOT EXISTS idx_audit_failures_module ON audit_failures(module);
CREATE INDEX IF NOT EXISTS idx_audit_failures_failure_timestamp ON audit_failures(failure_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_failures_request_id ON audit_failures(request_id);

ALTER TABLE audit_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit failures"
  ON audit_failures
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit failures"
  ON audit_failures
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
