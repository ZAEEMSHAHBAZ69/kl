/*
  # Fix data_retention_policy_logs table schema
  
  Update column names to match what the retention manager code expects:
  - Rename 'policy_name' to 'operation_type'
  - Rename 'records_deleted' to 'records_affected'
  - Rename 'execution_status' to 'status'
  - Add 'target_table' column
  - Add 'details' column (text instead of jsonb for simpler logging)
*/

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Add operation_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'operation_type'
  ) THEN
    ALTER TABLE data_retention_policy_logs 
    ADD COLUMN operation_type text;
  END IF;

  -- Add target_table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'target_table'
  ) THEN
    ALTER TABLE data_retention_policy_logs 
    ADD COLUMN target_table text;
  END IF;

  -- Add records_affected
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'records_affected'
  ) THEN
    ALTER TABLE data_retention_policy_logs 
    ADD COLUMN records_affected integer DEFAULT 0;
  END IF;

  -- Add status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE data_retention_policy_logs 
    ADD COLUMN status text;
  END IF;

  -- Add details as text
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'details'
    AND data_type = 'jsonb'
  ) THEN
    -- Change details from jsonb to text
    ALTER TABLE data_retention_policy_logs 
    ALTER COLUMN details TYPE text USING details::text;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'details'
  ) THEN
    ALTER TABLE data_retention_policy_logs 
    ADD COLUMN details text;
  END IF;
END $$;

-- Drop old columns if they exist and new ones are populated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'policy_name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'operation_type'
  ) THEN
    ALTER TABLE data_retention_policy_logs DROP COLUMN policy_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'records_deleted'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'records_affected'
  ) THEN
    ALTER TABLE data_retention_policy_logs DROP COLUMN records_deleted;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'execution_status'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'data_retention_policy_logs' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE data_retention_policy_logs DROP COLUMN execution_status;
  END IF;
END $$;

-- Add constraints
ALTER TABLE data_retention_policy_logs 
DROP CONSTRAINT IF EXISTS data_retention_policy_logs_status_check;

ALTER TABLE data_retention_policy_logs 
ADD CONSTRAINT data_retention_policy_logs_status_check 
CHECK (status IN ('SUCCESS', 'FAILURE'));

-- Add comments
COMMENT ON COLUMN data_retention_policy_logs.operation_type IS 
'Type of retention operation: ARCHIVE or DELETE';

COMMENT ON COLUMN data_retention_policy_logs.target_table IS 
'Name of the table that was cleaned up';

COMMENT ON COLUMN data_retention_policy_logs.records_affected IS 
'Number of records archived or deleted';

COMMENT ON COLUMN data_retention_policy_logs.status IS 
'Operation status: SUCCESS or FAILURE';
