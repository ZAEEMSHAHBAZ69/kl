/*
  # Create Content Analysis Tracking Tables

  1. New Tables for content analysis tracking and persistence
    - content_analysis_results: Store complete analysis fingerprints
    - content_analysis_history: Track changes over time
    - similarity_fingerprints: Store SimHash for duplicate detection
    - content_risk_trends: Aggregate daily trends

  2. Indexes for performance optimization
    - Publisher ID for fast queries
    - SimHash for duplicate detection
    - Timestamps for range queries
    - Flag status for filtering
*/

CREATE TABLE IF NOT EXISTS content_analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  page_url text NOT NULL,
  content_hash text,
  simhash text,
  analysis_timestamp timestamptz DEFAULT now(),
  entropy_metrics jsonb,
  similarity_metrics jsonb,
  readability_metrics jsonb,
  ai_metrics jsonb,
  clickbait_metrics jsonb,
  freshness_metrics jsonb,
  risk_assessment jsonb,
  flag_status text DEFAULT 'clean',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_analysis_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_analysis_id uuid NOT NULL REFERENCES content_analysis_results(id) ON DELETE CASCADE,
  publisher_id uuid NOT NULL,
  previous_flag_status text,
  current_flag_status text NOT NULL,
  detected_changes text[] DEFAULT '{}',
  risk_score_change numeric,
  comparison_timestamp timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS similarity_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_analysis_id uuid NOT NULL REFERENCES content_analysis_results(id) ON DELETE CASCADE,
  publisher_id uuid NOT NULL,
  simhash text NOT NULL UNIQUE,
  content_length integer,
  token_count integer,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  duplicate_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_risk_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  analysis_date date NOT NULL,
  avg_risk_score numeric,
  avg_ai_score numeric,
  avg_clickbait_score numeric,
  avg_entropy_score numeric,
  content_flag_changes integer DEFAULT 0,
  analysis_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(publisher_id, analysis_date)
);

CREATE INDEX IF NOT EXISTS idx_content_analysis_publisher ON content_analysis_results(publisher_id);
CREATE INDEX IF NOT EXISTS idx_content_analysis_timestamp ON content_analysis_results(analysis_timestamp);
CREATE INDEX IF NOT EXISTS idx_content_analysis_flag_status ON content_analysis_results(flag_status);
CREATE INDEX IF NOT EXISTS idx_content_analysis_simhash ON content_analysis_results(simhash);
CREATE INDEX IF NOT EXISTS idx_similarity_fingerprints_simhash ON similarity_fingerprints(simhash);
CREATE INDEX IF NOT EXISTS idx_similarity_fingerprints_publisher ON similarity_fingerprints(publisher_id);
CREATE INDEX IF NOT EXISTS idx_content_risk_trends_date ON content_risk_trends(analysis_date);
CREATE INDEX IF NOT EXISTS idx_content_risk_trends_publisher ON content_risk_trends(publisher_id);
CREATE INDEX IF NOT EXISTS idx_content_analysis_history_publisher ON content_analysis_history(publisher_id);

ALTER TABLE content_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE similarity_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_risk_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users"
  ON content_analysis_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable write access for authenticated users"
  ON content_analysis_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
  ON content_analysis_results FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users"
  ON content_analysis_results FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Enable read access for content_analysis_history"
  ON content_analysis_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable write access for content_analysis_history"
  ON content_analysis_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable read access for similarity_fingerprints"
  ON similarity_fingerprints FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable write access for similarity_fingerprints"
  ON similarity_fingerprints FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable read access for content_risk_trends"
  ON content_risk_trends FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable write access for content_risk_trends"
  ON content_risk_trends FOR INSERT
  TO authenticated
  WITH CHECK (true);
