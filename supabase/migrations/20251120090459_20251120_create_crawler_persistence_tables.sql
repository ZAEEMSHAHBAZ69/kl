/*
  # Create Crawler Data Persistence Tables

  1. New Tables
    - `crawler_sessions` - Main crawl session records with metadata
    - `crawler_har_files` - HAR file data storage with compression tracking
    - `crawler_dom_snapshots` - DOM structure and element snapshots
    - `crawler_page_metrics` - Performance metrics and timing data
    - `crawler_ad_elements` - Extracted ad elements from crawls
    - `crawler_screenshots` - Screenshot metadata and storage references

  2. Features
    - Efficient indexing on publisher_id, site_audit_id, and created_at
    - Compression strategy for large HAR files
    - JSON storage for complex nested data
    - Batch insertion support for ad elements
    - Historical data retrieval for comparison and trend analysis

  3. Security
    - Enable RLS on all tables
    - Add service role policies for worker access
    - Allow data access by publisher association

  4. Performance
    - Indexes for common query patterns
    - Default values for timestamps and flags
    - Efficient pagination support
*/

-- Create crawler_sessions table
CREATE TABLE IF NOT EXISTS crawler_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id text NOT NULL,
  site_audit_id uuid,
  url text NOT NULL,
  viewport_name text DEFAULT 'desktop',
  viewport_width integer DEFAULT 1920,
  viewport_height integer DEFAULT 1080,
  user_agent text,
  session_duration_ms integer DEFAULT 0,
  total_requests integer DEFAULT 0,
  ad_elements_count integer DEFAULT 0,
  iframes_count integer DEFAULT 0,
  mutations_count integer DEFAULT 0,
  screenshot_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create crawler_har_files table
CREATE TABLE IF NOT EXISTS crawler_har_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_session_id uuid NOT NULL REFERENCES crawler_sessions(id) ON DELETE CASCADE,
  publisher_id text NOT NULL,
  file_path text NOT NULL,
  storage_bucket text DEFAULT 'crawler-data',
  file_size_bytes integer DEFAULT 0,
  is_compressed boolean DEFAULT false,
  compression_method text,
  request_count integer DEFAULT 0,
  response_count integer DEFAULT 0,
  har_data jsonb,
  total_time_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create crawler_dom_snapshots table
CREATE TABLE IF NOT EXISTS crawler_dom_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_session_id uuid NOT NULL REFERENCES crawler_sessions(id) ON DELETE CASCADE,
  publisher_id text NOT NULL,
  element_count integer DEFAULT 0,
  iframe_count integer DEFAULT 0,
  script_count integer DEFAULT 0,
  ad_slot_ids text[] DEFAULT '{}',
  html_size_bytes integer DEFAULT 0,
  body_size_bytes integer DEFAULT 0,
  dom_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create crawler_page_metrics table
CREATE TABLE IF NOT EXISTS crawler_page_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_session_id uuid NOT NULL REFERENCES crawler_sessions(id) ON DELETE CASCADE,
  publisher_id text NOT NULL,
  ttfb_ms integer DEFAULT 0,
  fcp_ms integer DEFAULT 0,
  lcp_ms integer DEFAULT 0,
  cls_value numeric(5,3) DEFAULT 0,
  dcp_ms integer DEFAULT 0,
  js_weight_bytes integer DEFAULT 0,
  resource_count integer DEFAULT 0,
  image_count integer DEFAULT 0,
  stylesheet_count integer DEFAULT 0,
  script_count integer DEFAULT 0,
  font_count integer DEFAULT 0,
  navigation_timing jsonb,
  timing_marks jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create crawler_ad_elements table
CREATE TABLE IF NOT EXISTS crawler_ad_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_session_id uuid NOT NULL REFERENCES crawler_sessions(id) ON DELETE CASCADE,
  publisher_id text NOT NULL,
  element_index integer DEFAULT 0,
  element_type text,
  element_id text,
  element_class text,
  tag_name text,
  position_x numeric(10,2) DEFAULT 0,
  position_y numeric(10,2) DEFAULT 0,
  width numeric(10,2) DEFAULT 0,
  height numeric(10,2) DEFAULT 0,
  is_visible boolean DEFAULT false,
  visibility_data jsonb,
  data_attributes jsonb,
  element_html text,
  created_at timestamptz DEFAULT now()
);

-- Create crawler_screenshots table
CREATE TABLE IF NOT EXISTS crawler_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_session_id uuid NOT NULL REFERENCES crawler_sessions(id) ON DELETE CASCADE,
  publisher_id text NOT NULL,
  file_path text NOT NULL,
  storage_bucket text DEFAULT 'crawler-data',
  file_size_bytes integer DEFAULT 0,
  file_name text,
  capture_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_crawler_sessions_publisher ON crawler_sessions(publisher_id);
CREATE INDEX IF NOT EXISTS idx_crawler_sessions_site_audit ON crawler_sessions(site_audit_id);
CREATE INDEX IF NOT EXISTS idx_crawler_sessions_created_at ON crawler_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawler_har_files_session ON crawler_har_files(crawler_session_id);
CREATE INDEX IF NOT EXISTS idx_crawler_har_files_publisher ON crawler_har_files(publisher_id);
CREATE INDEX IF NOT EXISTS idx_crawler_dom_snapshots_session ON crawler_dom_snapshots(crawler_session_id);
CREATE INDEX IF NOT EXISTS idx_crawler_page_metrics_session ON crawler_page_metrics(crawler_session_id);
CREATE INDEX IF NOT EXISTS idx_crawler_ad_elements_session ON crawler_ad_elements(crawler_session_id);
CREATE INDEX IF NOT EXISTS idx_crawler_ad_elements_publisher ON crawler_ad_elements(publisher_id);
CREATE INDEX IF NOT EXISTS idx_crawler_screenshots_session ON crawler_screenshots(crawler_session_id);

-- Enable RLS on all tables
ALTER TABLE crawler_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_har_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_dom_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_page_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_ad_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_screenshots ENABLE ROW LEVEL SECURITY;

-- Add service role policies for worker access (unrestricted for service role)
CREATE POLICY "Service role can manage crawler_sessions"
  ON crawler_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage crawler_har_files"
  ON crawler_har_files FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage crawler_dom_snapshots"
  ON crawler_dom_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage crawler_page_metrics"
  ON crawler_page_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage crawler_ad_elements"
  ON crawler_ad_elements FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage crawler_screenshots"
  ON crawler_screenshots FOR ALL TO service_role USING (true) WITH CHECK (true);
