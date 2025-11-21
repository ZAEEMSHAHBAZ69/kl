/*
  # Add Admin Update Policy for Publishers

  ## Summary
  Adds missing RLS policy to allow admins and super admins to update publishers (specifically partner_id).
  
  ## Changes
  - Add UPDATE policy for admins on publishers table
  - Allows admin/super_admin authenticated users to update publisher fields
  
  ## Security
  - Restricted to authenticated users with admin/super_admin roles (checked via JWT)
  - No data loss - only adds missing permission for authorized operations
*/

-- Add policy to allow admins to update publishers
CREATE POLICY "publishers admin update"
  ON publishers FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM auth.users WHERE auth.users.id = auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    (SELECT role FROM auth.users WHERE auth.users.id = auth.uid()) IN ('admin', 'super_admin')
  );
