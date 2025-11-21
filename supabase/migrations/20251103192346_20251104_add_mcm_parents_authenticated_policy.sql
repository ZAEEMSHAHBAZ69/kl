/*
  # Add MCM Parents Authenticated Read Policy

  ## Summary
  MCM parents need to be visible to all authenticated users since they're required for:
  - Adding new publishers (all roles need to select a parent MCM)
  - Reports page (users need to filter by parent network)

  ## Changes
  - Add SELECT policy for authenticated users to read all mcm_parents
  - No role-based restrictions needed since this is read-only reference data
  - All users (partners, admins, super_admins) need access to view available parent networks
*/

-- Add authenticated read policy for mcm_parents
CREATE POLICY "mcm_parents authenticated read"
  ON mcm_parents FOR SELECT TO authenticated USING (true);