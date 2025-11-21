/*
  # Fix publisher_trend_alerts table schema
  
  Add missing fields and status values that are used by the alert engine:
  - Add 'notified_at' timestamp field
  - Add 'notified' and 'acknowledged' to status enum
*/

-- Add notified_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'publisher_trend_alerts' 
    AND column_name = 'notified_at'
  ) THEN
    ALTER TABLE publisher_trend_alerts 
    ADD COLUMN notified_at timestamptz;
    
    CREATE INDEX IF NOT EXISTS idx_publisher_trend_alerts_notified_at 
    ON publisher_trend_alerts(notified_at DESC);
  END IF;
END $$;

-- Drop the existing status constraint
ALTER TABLE publisher_trend_alerts 
DROP CONSTRAINT IF EXISTS publisher_trend_alerts_status_check;

-- Add the new constraint with all status values
ALTER TABLE publisher_trend_alerts 
ADD CONSTRAINT publisher_trend_alerts_status_check 
CHECK (status IN ('active', 'notified', 'acknowledged', 'resolved', 'dismissed'));

-- Add comment to document the status flow
COMMENT ON COLUMN publisher_trend_alerts.status IS 
'Alert status flow: active → notified → acknowledged → resolved/dismissed';

COMMENT ON COLUMN publisher_trend_alerts.notified_at IS 
'Timestamp when alert notification was sent to admins';
