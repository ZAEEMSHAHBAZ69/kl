/*
  # Create Audit Orchestration Tables

  1. New Tables
    - `audit_queue`: Tracks audit job execution with status and timestamps
    - `audit_results`: Stores complete audit analysis results including all module outputs
    - `audit_failures`: Logs failed audit attempts with error details for debugging
    - `publisher_schedules`: Manages CRON-based recurring audit schedules per publisher
    - `publisher_sites`: Links publishers to their monitored sites

  2. Security
    - Enable RLS on all tables
    - Implement service role access for background workers
    - Restrict user access based on publisher ownership

  3. Key Features
    - Audit queue tracks job lifecycle (pending → running → completed/failed)
    - Results table stores comprehensive analysis with composite data from all modules
    - Failures logged separately for debugging and circuit breaker logic
    - Schedules enable flexible CRON-based execution with interval tracking
*/

CREATE TABLE IF NOT EXISTS audit_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  sites jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  queued_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT audit_queue_publisher_fk FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  audit_type text DEFAULT 'full_site_audit',
  crawler_data jsonb,
  content_analysis jsonb,
  ad_analysis jsonb,
  policy_check jsonb,
  technical_check jsonb,
  risk_score numeric(5, 2) DEFAULT 0,
  ai_report jsonb,
  audit_timestamp timestamptz DEFAULT now(),
  raw_results jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT audit_results_publisher_fk FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  job_id uuid,
  module text NOT NULL,
  error_message text,
  error_stack text,
  failure_timestamp timestamptz DEFAULT now(),
  request_id uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT audit_failures_publisher_fk FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS publisher_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  schedule_name text NOT NULL,
  cron_expression text DEFAULT '0 2 * * *',
  interval_ms bigint DEFAULT 86400000,
  enabled boolean DEFAULT true,
  last_run_at timestamptz,
  jobs_queued integer DEFAULT 0,
  execution_status text DEFAULT 'pending',
  last_error text,
  last_execution_duration_ms integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT audit_schedules_publisher_fk FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE,
  CONSTRAINT unique_schedule_per_publisher UNIQUE (publisher_id, schedule_name)
);

CREATE TABLE IF NOT EXISTS publisher_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id uuid NOT NULL,
  site_name text NOT NULL,
  site_url text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT publisher_sites_publisher_fk FOREIGN KEY (publisher_id) REFERENCES publishers(id) ON DELETE CASCADE
);

ALTER TABLE audit_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE publisher_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE publisher_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage audit queue"
  ON audit_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view audit queue for their publishers"
  ON audit_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM publishers
      WHERE publishers.id = audit_queue.publisher_id
      AND publishers.created_by = auth.uid()
    )
  );

CREATE POLICY "Service role can manage audit results"
  ON audit_results FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view audit results for their publishers"
  ON audit_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM publishers
      WHERE publishers.id = audit_results.publisher_id
      AND publishers.created_by = auth.uid()
    )
  );

CREATE POLICY "Service role can manage audit failures"
  ON audit_failures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view audit failures for their publishers"
  ON audit_failures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM publishers
      WHERE publishers.id = audit_failures.publisher_id
      AND publishers.created_by = auth.uid()
    )
  );

CREATE POLICY "Service role can manage publisher schedules"
  ON publisher_schedules FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view schedules for their publishers"
  ON publisher_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM publishers
      WHERE publishers.id = publisher_schedules.publisher_id
      AND publishers.created_by = auth.uid()
    )
  );

CREATE POLICY "Service role can manage publisher sites"
  ON publisher_sites FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view sites for their publishers"
  ON publisher_sites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM publishers
      WHERE publishers.id = publisher_sites.publisher_id
      AND publishers.created_by = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_audit_queue_publisher ON audit_queue(publisher_id);
CREATE INDEX IF NOT EXISTS idx_audit_queue_status ON audit_queue(status);
CREATE INDEX IF NOT EXISTS idx_audit_queue_created ON audit_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_results_publisher ON audit_results(publisher_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_timestamp ON audit_results(audit_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_failures_publisher ON audit_failures(publisher_id);
CREATE INDEX IF NOT EXISTS idx_audit_failures_module ON audit_failures(module);
CREATE INDEX IF NOT EXISTS idx_publisher_schedules_enabled ON publisher_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_publisher_sites_publisher ON publisher_sites(publisher_id);
