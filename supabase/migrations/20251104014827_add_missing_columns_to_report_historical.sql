/*
  # Add Missing Columns to report_historical Table

  1. Changes to report_historical table
    - Add country_criteria_id (bigint)
    - Add device_category_id (bigint)
    - Add browser_id (bigint)
    - Add operating_system_version_id (bigint)
    - Add matched_requests (bigint)
    - Add match_rate (numeric)
    - Add ad_request_ecpm (numeric)
    - Add mcm_auto_payment_revenue (numeric)
    - Add net_revenue (numeric)
    - Add measurable_impressions (bigint)
    - Add viewable_impressions (bigint)
    - Add delivery_rate (numeric)
    - Add currency_code (text)
    - Add updated_at (timestamp)
    - Rename 'requests' to 'ad_requests' if it exists
    - Align data types with reports_dimensional table

  2. Purpose
    - Ensure report_historical table has all necessary columns for GAM report data
    - Maintain consistency between report_historical and reports_dimensional schemas
    - Support historical data storage for new publishers
*/

DO $$
BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'country_criteria_id') THEN
    ALTER TABLE report_historical ADD COLUMN country_criteria_id bigint;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'device_category_id') THEN
    ALTER TABLE report_historical ADD COLUMN device_category_id bigint;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'browser_id') THEN
    ALTER TABLE report_historical ADD COLUMN browser_id bigint;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'operating_system_version_id') THEN
    ALTER TABLE report_historical ADD COLUMN operating_system_version_id bigint;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'matched_requests') THEN
    ALTER TABLE report_historical ADD COLUMN matched_requests bigint;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'match_rate') THEN
    ALTER TABLE report_historical ADD COLUMN match_rate numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'ad_request_ecpm') THEN
    ALTER TABLE report_historical ADD COLUMN ad_request_ecpm numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'mcm_auto_payment_revenue') THEN
    ALTER TABLE report_historical ADD COLUMN mcm_auto_payment_revenue numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'net_revenue') THEN
    ALTER TABLE report_historical ADD COLUMN net_revenue numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'measurable_impressions') THEN
    ALTER TABLE report_historical ADD COLUMN measurable_impressions bigint;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'viewable_impressions') THEN
    ALTER TABLE report_historical ADD COLUMN viewable_impressions bigint;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'delivery_rate') THEN
    ALTER TABLE report_historical ADD COLUMN delivery_rate numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'currency_code') THEN
    ALTER TABLE report_historical ADD COLUMN currency_code text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'updated_at') THEN
    ALTER TABLE report_historical ADD COLUMN updated_at timestamp with time zone DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'cleanup_scheduled_at') THEN
    ALTER TABLE report_historical ADD COLUMN cleanup_scheduled_at timestamp with time zone;
  END IF;
END $$;
