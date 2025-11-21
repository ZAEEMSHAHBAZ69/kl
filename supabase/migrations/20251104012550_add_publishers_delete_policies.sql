/*
  # Add DELETE policies for publishers table

  1. Security
    - Add DELETE policy for admins to delete any publisher
    - Add DELETE policy for partners to delete their own publishers
    - Service role can delete anything
*/

CREATE POLICY "publishers admin delete"
  ON publishers FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM app_users
    WHERE app_users.id = auth.uid()
    AND app_users.role = ANY(ARRAY['admin', 'super_admin'])
  ));

CREATE POLICY "publishers partner delete own"
  ON publishers FOR DELETE
  TO authenticated
  USING (
    partner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'partner'
    )
  );
