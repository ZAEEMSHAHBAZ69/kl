/*
  # Refresh PostgREST Schema Cache

  Force PostgREST to reload the schema definition to recognize the publisher_id
  column in the content_analysis_results table. This resolves schema cache mismatches
  that can occur after column additions or modifications.
*/

NOTIFY pgrst, 'reload schema';