/*
  # Fix Publishers RLS Policies

  1. Problem
    - Publishers RLS policies were checking auth.jwt() ->> 'role' which doesn't exist in the JWT
    - Supabase stores user metadata in app_metadata, not at top level
    - This caused all publisher queries to fail due to RLS blocking access

  2. Solution
    - Update all publishers RLS policies to check auth.jwt() -> 'app_metadata' ->> 'role'
    - This correctly reads the role from the JWT's app_metadata field
    - Policies now properly allow:
      - Admins and super_admins to read all publishers
      - Partners to read only their own publishers (where partner_id matches their user id)

  3. Affected Policies
    - publishers authenticated read: Read access for admins/super_admins and partners
    - publishers partner insert: Insert access for partners
    - publishers partner update approved: Update access for partners with approved publishers
    - publishers admin insert: Insert access for admins/super_admins
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
    (((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin'::text, 'super_admin'::text])) OR
    (((auth.jwt() -> 'app_metadata' ->> 'role') = 'partner'::text) AND (partner_id = auth.uid())))
  );

CREATE POLICY "publishers admin insert"
  ON publishers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin'::text, 'super_admin'::text]))
  );

CREATE POLICY "publishers partner insert"
  ON publishers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (((auth.jwt() -> 'app_metadata' ->> 'role') = 'partner'::text) AND (partner_id = auth.uid()) AND (admin_approved = false))
  );

CREATE POLICY "publishers partner update approved"
  ON publishers
  FOR UPDATE
  TO authenticated
  USING (
    ((partner_id = auth.uid()) AND (admin_approved = true))
  )
  WITH CHECK (
    ((partner_id = auth.uid()) AND (admin_approved = true))
  );
