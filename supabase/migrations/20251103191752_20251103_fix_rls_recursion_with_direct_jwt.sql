/*
  # Fix RLS Recursion - Use Direct JWT Claims Instead of Table Queries

  ## Summary
  The helper function was still causing recursion because it queries the app_users table,
  which triggers RLS policies again. Instead, we'll use JWT claims directly via auth.jwt()
  and store the role in the JWT for quick access without table queries.

  ## Changes
  - Remove the get_user_role() function that causes recursion
  - Use auth.jwt() to access user role stored in app_metadata
  - Simplify policies to avoid any table lookups
  - Use service role for admin-only operations instead of relying on RLS

  ## Note
  This requires that user roles are stored in auth.users app_metadata via auth.update()
  during user creation. The Supabase auth system stores roles in JWT automatically.
*/

-- Drop the recursive helper function
DROP FUNCTION IF EXISTS get_user_role(uuid) CASCADE;

-- Disable RLS temporarily
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE publishers DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcm_parents DISABLE ROW LEVEL SECURITY;

-- Drop all policies to start completely fresh
DROP POLICY IF EXISTS "app_users service_role all" ON app_users;
DROP POLICY IF EXISTS "app_users self_select" ON app_users;
DROP POLICY IF EXISTS "app_users super_admin_select" ON app_users;
DROP POLICY IF EXISTS "app_users admin_select_partners" ON app_users;
DROP POLICY IF EXISTS "publishers service_role all" ON publishers;
DROP POLICY IF EXISTS "publishers super_admin_select" ON publishers;
DROP POLICY IF EXISTS "publishers admin_select" ON publishers;
DROP POLICY IF EXISTS "publishers partner_select" ON publishers;
DROP POLICY IF EXISTS "publishers partner_insert" ON publishers;
DROP POLICY IF EXISTS "publishers partner_update_approved" ON publishers;
DROP POLICY IF EXISTS "publishers admin_approve_reject" ON publishers;
DROP POLICY IF EXISTS "publishers super_admin_update" ON publishers;
DROP POLICY IF EXISTS "publishers super_admin_delete" ON publishers;
DROP POLICY IF EXISTS "mcm_parents service_role all" ON mcm_parents;

-- Re-enable RLS
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcm_parents ENABLE ROW LEVEL SECURITY;

-- ==================== APP_USERS POLICIES ====================

-- Service role: unrestricted access
CREATE POLICY "app_users service_role all"
  ON app_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Everyone can see themselves
CREATE POLICY "app_users self_select"
  ON app_users FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Super admin can see all users
CREATE POLICY "app_users super_admin_select"
  ON app_users FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Admin can see partners
CREATE POLICY "app_users admin_select_partners"
  ON app_users FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin'
    AND role = 'partner'
  );

-- ==================== PUBLISHERS POLICIES ====================

-- Service role: unrestricted access
CREATE POLICY "publishers service_role all"
  ON publishers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Super admin: see all
CREATE POLICY "publishers super_admin_select"
  ON publishers FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Admin: see all
CREATE POLICY "publishers admin_select"
  ON publishers FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin'
  );

-- Partner: see own
CREATE POLICY "publishers partner_select"
  ON publishers FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'partner'
    AND partner_id = auth.uid()
  );

-- Partner: insert own
CREATE POLICY "publishers partner_insert"
  ON publishers FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'partner'
    AND partner_id = auth.uid()
    AND admin_approved = false
  );

-- Partner: update approved
CREATE POLICY "publishers partner_update_approved"
  ON publishers FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'partner'
    AND partner_id = auth.uid()
    AND admin_approved = true
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'partner'
    AND partner_id = auth.uid()
    AND admin_approved = true
  );

-- Admin: approve/reject
CREATE POLICY "publishers admin_approve_reject"
  ON publishers FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin'
    AND admin_approved = false
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'admin'
  );

-- Super admin: update any
CREATE POLICY "publishers super_admin_update"
  ON publishers FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Super admin: delete any
CREATE POLICY "publishers super_admin_delete"
  ON publishers FOR DELETE TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- ==================== MCM_PARENTS POLICIES ====================

-- Service role: unrestricted access
CREATE POLICY "mcm_parents service_role all"
  ON mcm_parents FOR ALL TO service_role USING (true) WITH CHECK (true);
