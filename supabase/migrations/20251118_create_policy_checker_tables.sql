/*
  # Create Policy Compliance Tracking Tables

  1. New Tables
    - `policy_compliance_results`
      - `id` (uuid, primary key)
      - `publisher_id` (text) - Publisher/domain identifier
      - `domain` (text) - Website domain being audited
      - `jurisdiction` (text) - Detected primary jurisdiction
      - `all_jurisdictions` (text[]) - All detected jurisdictions
      - `jurisdiction_confidence` (numeric) - Confidence score for jurisdiction detection
      - `compliance_level` (text) - Overall compliance: compliant, warning, non_compliant
      - `total_policies` (integer) - Total policies evaluated
      - `compliant_policies` (integer) - Number of compliant policies
      - `violating_policies` (integer) - Number of policies with violations
      - `total_violations` (integer) - Total violation count
      - `critical_violations` (integer) - Count of critical violations
      - `high_violations` (integer) - Count of high violations
      - `medium_violations` (integer) - Count of medium violations
      - `low_violations` (integer) - Count of low violations
      - `policy_statuses` (jsonb) - Individual policy status details
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `policy_violations`
      - `id` (uuid, primary key)
      - `compliance_result_id` (uuid, foreign key)
      - `publisher_id` (text) - Publisher/domain identifier
      - `domain` (text) - Website domain
      - `policy_name` (text) - Name of violated policy
      - `violation_type` (text) - Type: category_violation, restricted_keyword_violation
      - `severity` (text) - critical, high, medium, low
      - `is_critical` (boolean) - Flag for critical violations
      - `violation_details` (jsonb) - Detailed violation information
      - `created_at` (timestamp)

    - `restricted_keyword_matches`
      - `id` (uuid, primary key)
      - `compliance_result_id` (uuid, foreign key)
      - `publisher_id` (text) - Publisher/domain identifier
      - `domain` (text) - Website domain
      - `keyword` (text) - Matched keyword
      - `category` (text) - Keyword category (ad_blocking_tricks, counterfeit, etc.)
      - `severity` (text) - critical, high
      - `context` (text) - Text context around the keyword (50 chars before/after)
      - `created_at` (timestamp)

    - `category_detections`
      - `id` (uuid, primary key)
      - `compliance_result_id` (uuid, foreign key)
      - `publisher_id` (text) - Publisher/domain identifier
      - `domain` (text) - Website domain
      - `category` (text) - Detected category
      - `confidence` (numeric) - Confidence score (0-1)
      - `risk_level` (text) - Risk level assessment
      - `sensitive_categories` (text[]) - List of sensitive categories detected
      - `detection_details` (jsonb) - Additional detection details
      - `created_at` (timestamp)

    - `compliance_history`
      - `id` (uuid, primary key)
      - `publisher_id` (text) - Publisher/domain identifier
      - `domain` (text) - Website domain
      - `previous_compliance_level` (text) - Previous compliance status
      - `new_compliance_level` (text) - New compliance status
      - `previous_violations_count` (integer) - Previous violation count
      - `new_violations_count` (integer) - New violation count
      - `change_reason` (jsonb) - Details about what changed
      - `created_at` (timestamp)

  2. Indexes
    - policy_compliance_results: (publisher_id, created_at DESC), (domain)
    - policy_violations: (compliance_result_id, severity)
    - restricted_keyword_matches: (compliance_result_id, category)
    - category_detections: (compliance_result_id)
    - compliance_history: (publisher_id, created_at DESC)

  3. Security
    - Enable RLS on all tables
    - Service role policies for worker operations
*/

CREATE TABLE IF NOT EXISTS policy_compliance_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id text NOT NULL,
  domain text NOT NULL,
  jurisdiction text,
  all_jurisdictions text[],
  jurisdiction_confidence numeric DEFAULT 0,
  compliance_level text NOT NULL DEFAULT 'compliant',
  total_policies integer DEFAULT 0,
  compliant_policies integer DEFAULT 0,
  violating_policies integer DEFAULT 0,
  total_violations integer DEFAULT 0,
  critical_violations integer DEFAULT 0,
  high_violations integer DEFAULT 0,
  medium_violations integer DEFAULT 0,
  low_violations integer DEFAULT 0,
  policy_statuses jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policy_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_result_id uuid REFERENCES policy_compliance_results(id) ON DELETE CASCADE,
  publisher_id text NOT NULL,
  domain text NOT NULL,
  policy_name text NOT NULL,
  violation_type text,
  severity text NOT NULL,
  is_critical boolean DEFAULT false,
  violation_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restricted_keyword_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_result_id uuid REFERENCES policy_compliance_results(id) ON DELETE CASCADE,
  publisher_id text NOT NULL,
  domain text NOT NULL,
  keyword text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  context text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_result_id uuid REFERENCES policy_compliance_results(id) ON DELETE CASCADE,
  publisher_id text NOT NULL,
  domain text NOT NULL,
  category text NOT NULL,
  confidence numeric DEFAULT 0,
  risk_level text,
  sensitive_categories text[],
  detection_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id text NOT NULL,
  domain text NOT NULL,
  previous_compliance_level text,
  new_compliance_level text NOT NULL,
  previous_violations_count integer DEFAULT 0,
  new_violations_count integer DEFAULT 0,
  change_reason jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_compliance_publisher_date
  ON policy_compliance_results(publisher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_policy_compliance_domain
  ON policy_compliance_results(domain);

CREATE INDEX IF NOT EXISTS idx_policy_violations_result_severity
  ON policy_violations(compliance_result_id, severity);

CREATE INDEX IF NOT EXISTS idx_keyword_matches_result_category
  ON restricted_keyword_matches(compliance_result_id, category);

CREATE INDEX IF NOT EXISTS idx_category_detections_result
  ON category_detections(compliance_result_id);

CREATE INDEX IF NOT EXISTS idx_compliance_history_publisher_date
  ON compliance_history(publisher_id, created_at DESC);

ALTER TABLE policy_compliance_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restricted_keyword_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage compliance results"
  ON policy_compliance_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage violations"
  ON policy_violations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage keyword matches"
  ON restricted_keyword_matches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage category detections"
  ON category_detections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage history"
  ON compliance_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
