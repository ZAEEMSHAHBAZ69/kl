/*
  # Refresh audit_logs schema cache

  This migration refreshes the schema cache by adding a comment to the audit_logs table.
  This resolves the PGRST204 error where PostgREST cannot find the 'context' column.
*/

COMMENT ON TABLE audit_logs IS 'Audit logs for worker process events and tracking';
