/*
  # Create report_historical and audit_job_queue tables

  1. New Tables
    - `report_historical`: Stores raw GAM report data from all sources
      - Tracks metrics: revenue, impressions, clicks, ad_requests, viewability, ecpm, ctr
      - Tracks dimensions: site_name, country, device, browser, os, mobile app, carrier
      - Metadata: source, trigger_type, timestamps
      - Unique constraint on (publisher_id, date, dimensions)
    
    - `audit_job_queue`: Queue for site audits (new publisher flow only)
      - Tracks queued site audits with status
      - Stores site details as JSONB
      - Manages worker attempts and error tracking

  2. Security
    - Enable RLS on both tables
    - Policies allow authenticated users to access their own data
    - Row-level checks via publisher relationships

  3. Indexes
    - (publisher_id, date) for fast daily aggregations
    - (date) for period queries
    - (status) for queue processing

  4. Key Notes
    - report_historical: Upsert-safe via unique constraint
    - audit_job_queue: Single active queue per publisher constraint
    - Both tables linked to publishers(id) with data integrity
*/

CREATE TABLE IF NOT EXISTS report_historical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Metrics
  revenue DECIMAL(12, 2),
  impressions BIGINT,
  clicks BIGINT,
  ad_requests BIGINT,
  viewability DECIMAL(5, 2),
  ecpm DECIMAL(8, 4),
  ctr DECIMAL(5, 2),

  -- Dimensions (nullable for multi-dimensional analysis)
  site_name TEXT,
  country_name TEXT,
  device_category_name TEXT,
  browser_name TEXT,
  operating_system_name TEXT,
  mobile_app_name TEXT,
  carrier_name TEXT,

  -- Metadata
  source VARCHAR(50),
  trigger_type VARCHAR(100),
  fetched_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(publisher_id, date, site_name, country_name, device_category_name, browser_name, operating_system_name, mobile_app_name, carrier_name)
);

CREATE INDEX IF NOT EXISTS idx_report_historical_publisher_date ON report_historical(publisher_id, date);
CREATE INDEX IF NOT EXISTS idx_report_historical_date ON report_historical(date);

ALTER TABLE report_historical ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view report_historical for their publishers"
  ON report_historical FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM publishers p
      WHERE p.id = report_historical.publisher_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM app_users au
          WHERE au.id = auth.uid()
          AND (au.role IN ('admin', 'super_admin') OR au.id = p.partner_id)
        )
      )
    )
  );

CREATE POLICY "Service role can insert report_historical"
  ON report_historical FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS audit_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  sites JSONB NOT NULL,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending',
  worker_attempts INT DEFAULT 0,
  last_error TEXT,

  -- Metadata
  triggered_by VARCHAR(50),
  queued_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_queue_status ON audit_job_queue(status);
CREATE INDEX IF NOT EXISTS idx_audit_queue_publisher_id ON audit_job_queue(publisher_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_queue_pending_publisher ON audit_job_queue(publisher_id) WHERE status IN ('pending', 'processing');

ALTER TABLE audit_job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit_job_queue for their publishers"
  ON audit_job_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM publishers p
      WHERE p.id = audit_job_queue.publisher_id
      AND (
        p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM app_users au
          WHERE au.id = auth.uid()
          AND (au.role IN ('admin', 'super_admin') OR au.id = p.partner_id)
        )
      )
    )
  );

CREATE POLICY "Service role can manage audit_job_queue"
  ON audit_job_queue FOR ALL
  TO service_role
  WITH CHECK (true);
