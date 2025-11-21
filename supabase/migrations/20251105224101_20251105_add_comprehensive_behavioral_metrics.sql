/*
  # Add Comprehensive Event-Aware Behavioral Metrics Columns

  1. New Columns for Behavioral Metrics
    - `behavioral_metrics` (jsonb) - Comprehensive event-aware behavioral data including:
      * adNetworkRequests: { count, domains[], urls[] }
      * hiddenIframes: { count, iframes[] }
      * autoRefreshDetected: boolean
      * autoRefreshCount: number
      * newAdsAfterLoad: { count, elements[] }
      * popupsDetected: { count, attempts[] }
      * redirectsDetected: { count, urls[] }
      * lazyLoadingPatterns: []
      * adBehaviorSequence: []

  2. Tables Updated
    - audit_queue
    - reports
    - reports_dimensional
    - report_historical

  3. Purpose
    - Store comprehensive event-aware behavioral ad tracking data
    - Capture dynamic ad behaviors (not just static analysis)
    - Track network requests to ad servers in real-time
    - Monitor ad refresh patterns and lazy-loading
    - Detect popup attempts and page redirects
    - Provide detailed sequence of ad behavior events

  4. Implementation Details
    - JSONB format for flexible behavioral data storage
    - Captures Playwright network instrumentation
    - Monitors ad visibility changes over 5-second periods
    - Tracks initial vs final ad counts
    - Records window.open interception and redirects
    - All columns nullable for backward compatibility

  5. Data Structure Examples
    Hidden iframes array: [{ id, src, dimensions, display, visibility, dataSlot }]
    Ad network requests: { count: 5, domains: ['googlesyndication.com', 'doubleclick.net'], urls: [...] }
    Lazy-loading patterns: [{ stage, iframeCount, adCount, visibleAds, deltaFromInitial: { iframes, ads } }]
    Behavior sequence: [{ event, counts, popups, redirects }]
*/

DO $$
BEGIN
  -- Add behavioral_metrics column to audit_queue
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_queue') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_queue' AND column_name = 'behavioral_metrics') THEN
      ALTER TABLE audit_queue ADD COLUMN behavioral_metrics jsonb DEFAULT '{}'::jsonb;
    END IF;
  END IF;

  -- Add behavioral_metrics column to reports
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reports') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'behavioral_metrics') THEN
      ALTER TABLE reports ADD COLUMN behavioral_metrics jsonb DEFAULT '{}'::jsonb;
    END IF;
  END IF;

  -- Add behavioral_metrics column to reports_dimensional
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reports_dimensional') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports_dimensional' AND column_name = 'behavioral_metrics') THEN
      ALTER TABLE reports_dimensional ADD COLUMN behavioral_metrics jsonb DEFAULT '{}'::jsonb;
    END IF;
  END IF;

  -- Add behavioral_metrics column to report_historical
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_historical') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'behavioral_metrics') THEN
      ALTER TABLE report_historical ADD COLUMN behavioral_metrics jsonb DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END $$;

-- Create index for behavioral metrics JSONB queries
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_queue') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'audit_queue_behavioral_metrics_idx') THEN
      CREATE INDEX audit_queue_behavioral_metrics_idx ON audit_queue USING gin (behavioral_metrics);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reports') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'reports_behavioral_metrics_idx') THEN
      CREATE INDEX reports_behavioral_metrics_idx ON reports USING gin (behavioral_metrics);
    END IF;
  END IF;
END $$;