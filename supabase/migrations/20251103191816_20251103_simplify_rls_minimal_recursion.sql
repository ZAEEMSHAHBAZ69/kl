/*
  # Simplify RLS - Minimize Recursion with Permissive Base Policies

  ## Summary
  The fundamental issue is that any RLS policy that tries to check the user's role
  will cause recursion when querying app_users. The solution is to:
  1. Make app_users minimally restrictive - users can see most data
  2. Handle authorization in the application layer for sensitive operations
  3. Use service role with auth checks in backend functions for sensitive operations

  ## Changes
  - Remove all role-checking from app_users RLS (it's read-only data)
  - Keep restrictions on publishers based on partner_id (no recursion)
  - Use application-layer authorization instead of complex RLS rules
*/

-- Disable RLS temporarily
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE publishers DISABLE ROW LEVEL SECURITY;
ALTER TABLE mcm_parents DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
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
-- Minimal policies: authenticated users can read all app_users
-- Authorization is enforced in the application layer

-- Service role: full access
CREATE POLICY "app_users service_role all"
  ON app_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users: can read all (app layer enforces what they see)
CREATE POLICY "app_users authenticated read"
  ON app_users FOR SELECT TO authenticated USING (true);

-- ==================== PUBLISHERS POLICIES ====================

-- Service role: full access
CREATE POLICY "publishers service_role all"
  ON publishers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users: can read all (app layer enforces filtering)
CREATE POLICY "publishers authenticated read"
  ON publishers FOR SELECT TO authenticated USING (true);

-- Partner: can insert their own unapproved publishers
CREATE POLICY "publishers partner insert"
  ON publishers FOR INSERT TO authenticated
  WITH CHECK (
    partner_id = auth.uid()
    AND admin_approved = false
  );

-- Partner: can update their own approved publishers
CREATE POLICY "publishers partner update approved"
  ON publishers FOR UPDATE TO authenticated
  USING (
    partner_id = auth.uid()
    AND admin_approved = true
  )
  WITH CHECK (
    partner_id = auth.uid()
    AND admin_approved = true
  );

-- ==================== MCM_PARENTS POLICIES ====================

-- Service role: full access
CREATE POLICY "mcm_parents service_role all"
  ON mcm_parents FOR ALL TO service_role USING (true) WITH CHECK (true);
