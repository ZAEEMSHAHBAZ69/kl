/*
  # Fix Publishers RLS Policies - Query app_users Table

  1. Problem
    - The role is NOT stored in the JWT token or app_metadata
    - The role is only stored in the app_users table
    - RLS policies were checking the wrong location for the role
    - This prevented all users from accessing publishers

  2. Solution
    - Update RLS policies to query the app_users table to get the user's role
    - Use EXISTS subquery to check if user is an admin/super_admin or a partner

  3. New Policy Logic
    - Admins and super_admins can see all publishers
    - Partners can see only their own publishers (where partner_id = auth.uid())
*/

DROP POLICY IF EXISTS "publishers authenticated read" ON publishers;
DROP POLICY IF EXISTS "publishers partner insert" ON publishers;
DROP POLICY IF EXISTS "publishers partner update approved" ON publishers;
DROP POLICY IF EXISTS "publishers admin insert" ON publishers;

CREATE POLICY "publishers authenticated read"
  ON publishers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND (
        app_users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])
        OR (app_users.role = 'partner'::text AND publishers.partner_id = auth.uid())
      )
    )
  );

CREATE POLICY "publishers admin insert"
  ON publishers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])
    )
  );

CREATE POLICY "publishers partner insert"
  ON publishers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'partner'::text
      AND publishers.partner_id = auth.uid()
      AND publishers.admin_approved = false
    )
  );

CREATE POLICY "publishers partner update approved"
  ON publishers
  FOR UPDATE
  TO authenticated
  USING (
    publishers.partner_id = auth.uid()
    AND publishers.admin_approved = true
    AND EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'partner'::text
    )
  )
  WITH CHECK (
    publishers.partner_id = auth.uid()
    AND publishers.admin_approved = true
    AND EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'partner'::text
    )
  );
