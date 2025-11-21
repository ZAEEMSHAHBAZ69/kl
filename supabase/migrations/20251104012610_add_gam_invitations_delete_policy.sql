/*
  # Add DELETE policy for gam_invitations table

  1. Security
    - Add DELETE policy for service_role
*/

CREATE POLICY "gam_invitations service_role delete"
  ON gam_invitations FOR DELETE
  TO service_role
  USING (true);
