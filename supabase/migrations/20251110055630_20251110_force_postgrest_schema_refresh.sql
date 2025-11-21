/*
  # Force PostgREST schema cache refresh

  This migration forces PostgREST to refresh its schema cache by recreating
  the audit_logs table with a temporary column addition and removal.
  This resolves PGRST204 "Could not find column" errors.
*/

ALTER TABLE audit_logs ADD COLUMN _schema_refresh_temp boolean DEFAULT false;
ALTER TABLE audit_logs DROP COLUMN _schema_refresh_temp;

NOTIFY pgrst, 'reload schema';
