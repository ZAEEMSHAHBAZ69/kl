/*
  # Enhance AI Results RLS for Service Role

  1. Security Updates
    - Ensure service role has INSERT permission on ai_analysis_results
    - Ensure service role has SELECT permission on ai_analysis_results
    - Ensure service role has UPDATE permission on ai_analysis_results
    - Maintain existing authenticated user SELECT access
    - Update overly permissive service_role policy to be more specific

  2. Policy Changes
    - Add separate INSERT policy for service role
    - Add separate UPDATE policy for service role
    - Keep SELECT policy for authenticated users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_analysis_results' AND policyname = 'Service role can insert AI results'
  ) THEN
    CREATE POLICY "Service role can insert AI results"
      ON ai_analysis_results
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_analysis_results' AND policyname = 'Service role can update AI results'
  ) THEN
    CREATE POLICY "Service role can update AI results"
      ON ai_analysis_results
      FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_analysis_results' AND policyname = 'Service role can select AI results'
  ) THEN
    CREATE POLICY "Service role can select AI results"
      ON ai_analysis_results
      FOR SELECT
      TO service_role
      USING (true);
  END IF;
END $$;