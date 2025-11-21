/*
  # Fix Admin Update Policy for Publishers

  ## Summary
  Removes the problematic admin update policy and uses app_users table for role checking instead.
  
  ## Changes
  - Drop the recursive policy that causes issues
  - Add new policy using app_users table for role verification
  
  ## Security
  - Uses app_users table to verify admin role (no direct auth.users recursion)
  - Allows only authenticated admins to update publishers
*/

DROP POLICY IF EXISTS "publishers admin update" ON publishers;

-- Add policy to allow admins to update publishers
CREATE POLICY "publishers admin update"
  ON publishers FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.id = auth.uid() 
      AND app_users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_users 
      WHERE app_users.id = auth.uid() 
      AND app_users.role IN ('admin', 'super_admin')
    )
  );
