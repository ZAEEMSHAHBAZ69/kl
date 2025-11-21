/*
  # Fix Site Audits RLS Policies

  ## Problem
  - Current RLS policy on site_audits uses `USING (true)` which allows ALL authenticated users to see ALL audits
  - Frontend is querying site_audits but can't filter results properly
  - Worker inserts records successfully, but frontend can't retrieve them due to permission mismatch
  
  ## Solution
  - Replace overly permissive `USING (true)` policy with proper ownership checks
  - Admins can see all audits
  - Partners can only see audits for their own publishers
  - Service role (worker) maintains unrestricted access

  ## Changes
  - Drop existing permissive authenticated SELECT policy
  - Add new SELECT policy that checks publisher ownership via app_users table
  - Keep service_role policies unchanged (for worker access)
*/

DO $$
BEGIN
  -- Drop the overly permissive authenticated policy
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'site_audits'
    AND policyname = 'Authenticated users can view site audits'
  ) THEN
    DROP POLICY "Authenticated users can view site audits" ON site_audits;
  END IF;
END $$;

-- Add proper ownership-based SELECT policy for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'site_audits'
    AND policyname = 'Users can view site audits for their publishers'
  ) THEN
    CREATE POLICY "Users can view site audits for their publishers"
      ON site_audits
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM publishers
          WHERE publishers.id = site_audits.publisher_id
          AND (
            -- Admin/super_admin can see all audits
            EXISTS (
              SELECT 1 FROM app_users
              WHERE app_users.id = auth.uid()
              AND app_users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])
            )
            -- Partner can only see audits for their own publishers
            OR (
              publishers.partner_id = auth.uid()
              AND EXISTS (
                SELECT 1 FROM app_users
                WHERE app_users.id = auth.uid()
                AND app_users.role = 'partner'::text
              )
            )
          )
        )
      );
  END IF;
END $$;
