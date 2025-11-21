/*
  # Align report_historical and reports_dimensional schemas

  1. Changes
    - Remove extra columns from report_historical: source, trigger_type, fetched_at
    - Add 'requests' column to report_historical for consistency with reports_dimensional
    - Ensure both tables have identical column sets for seamless data migration

  2. Purpose
    - Ensure report_historical can accept the same data structure as reports_dimensional
    - Support flexible data movement between tables
    - Fix schema inconsistencies causing insert errors
*/

DO $$
BEGIN
  -- Add 'requests' column to report_historical if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'requests') THEN
    ALTER TABLE report_historical ADD COLUMN requests bigint;
  END IF;

  -- Drop extra columns from report_historical that don't exist in reports_dimensional
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'source') THEN
    ALTER TABLE report_historical DROP COLUMN source;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'trigger_type') THEN
    ALTER TABLE report_historical DROP COLUMN trigger_type;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_historical' AND column_name = 'fetched_at') THEN
    ALTER TABLE report_historical DROP COLUMN fetched_at;
  END IF;
END $$;
