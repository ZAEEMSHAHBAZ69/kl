/*
  # Add Ad Behavioral Metrics Columns

  1. New Columns
    - `ad_requests_count` (bigint) - Total ad network requests captured
    - `ad_responses_count` (bigint) - Successful ad responses received
    - `hidden_iframes_count` (bigint) - Invisible ad iframes detected
    - `auto_refresh_count` (bigint) - Auto-refresh or lazy-loaded ad patterns
    - `duplicate_slots_count` (bigint) - Duplicate ad slot instances
    - `ad_networks_detected` (text[]) - Array of detected ad network domains

  2. Purpose
    - Store real browser behavior metrics for ad analysis
    - Enable tracking of ad requests/responses via network instrumentation
    - Monitor iframe visibility and lazy-load patterns
    - Detect ad slot duplicates and auto-refresh behavior

  3. Implementation Notes
    - Metrics captured via Playwright network listeners
    - Includes ad network domain detection
    - Tracks lazy-loaded ads at 5+ second intervals
    - All columns nullable for backward compatibility
*/

DO $$
BEGIN
  -- Add ad behavior metrics columns to audit queue if they don't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_queue') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_queue' AND column_name = 'ad_requests_count') THEN
      ALTER TABLE audit_queue ADD COLUMN ad_requests_count bigint DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_queue' AND column_name = 'ad_responses_count') THEN
      ALTER TABLE audit_queue ADD COLUMN ad_responses_count bigint DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_queue' AND column_name = 'hidden_iframes_count') THEN
      ALTER TABLE audit_queue ADD COLUMN hidden_iframes_count bigint DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_queue' AND column_name = 'auto_refresh_count') THEN
      ALTER TABLE audit_queue ADD COLUMN auto_refresh_count bigint DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_queue' AND column_name = 'duplicate_slots_count') THEN
      ALTER TABLE audit_queue ADD COLUMN duplicate_slots_count bigint DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_queue' AND column_name = 'ad_networks_detected') THEN
      ALTER TABLE audit_queue ADD COLUMN ad_networks_detected text[];
    END IF;
  END IF;
END $$;