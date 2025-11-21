/*
  # Fix Partner Insert Policy

  ## Summary
  The "publishers partner insert" policy was missing the role check,
  allowing non-partners to attempt inserts. This adds the role restriction.

  ## Changes
  - Update partner insert policy to require role = 'partner'
  - Update authenticated read policy to only allow viewing own/related publishers

  ## Security
  - Partners can only insert their own publishers when admin_approved = false
  - Partners cannot see other partners' publishers
  - Any user (not just partner role) cannot insert publishers
*/

DROP POLICY IF EXISTS "publishers partner insert" ON publishers;
DROP POLICY IF EXISTS "publishers authenticated read" ON publishers;

-- Partner insert - only partner role can insert own publishers
CREATE POLICY "publishers partner insert"
  ON publishers FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'partner'
    AND partner_id = auth.uid()
    AND admin_approved = false
  );

-- Authenticated read - partners see only own, admins see all
CREATE POLICY "publishers authenticated read"
  ON publishers FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('admin', 'super_admin')
    OR (
      (auth.jwt() ->> 'role') = 'partner'
      AND partner_id = auth.uid()
    )
  );
