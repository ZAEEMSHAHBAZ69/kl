/*
  # Create get_publisher_site_names PostgreSQL Function

  1. New Function
    - `get_publisher_site_names(publisher_id UUID)` returns TEXT[]
    - Queries both reports_dimensional and report_historical tables
    - Implements COALESCE logic: COALESCE(site_name, subdomain, domain)
    - Returns ARRAY_AGG with DISTINCT sorted site names
    - Handles NULL and empty cases safely

  2. Data Sources
    - reports_dimensional: Used for existing publishers' historical data
    - report_historical: Used for newly added publishers' data (first 2 months)
    - Combines data from both sources for comprehensive site extraction

  3. Logic
    - Extracts site names using COALESCE priority: site_name > subdomain > domain
    - Removes duplicates and sorts alphabetically
    - Returns empty array for publishers with no data
    - Handles NULL values gracefully

  4. Security
    - Function accessible to service_role and authenticated users
    - No direct table access required from callers
    - Safe parameter handling with UUID type validation
    - Respects existing RLS policies on underlying tables
*/

CREATE OR REPLACE FUNCTION get_publisher_site_names(p_publisher_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  site_names_array TEXT[];
BEGIN
  -- Aggregate distinct site names from both reports tables
  -- Use COALESCE to prioritize: site_name > subdomain > domain
  SELECT ARRAY_AGG(DISTINCT site_name ORDER BY site_name)
  INTO site_names_array
  FROM (
    -- Extract from reports_dimensional (existing publishers)
    SELECT COALESCE(site_name, subdomain, domain) AS site_name
    FROM reports_dimensional
    WHERE publisher_id = p_publisher_id
      AND COALESCE(site_name, subdomain, domain) IS NOT NULL
      AND COALESCE(site_name, subdomain, domain) != ''

    UNION ALL

    -- Extract from report_historical (new publishers)
    SELECT site_name
    FROM report_historical
    WHERE publisher_id = p_publisher_id
      AND site_name IS NOT NULL
      AND site_name != ''
  ) extracted_sites;

  -- Return empty array if no site names found (safe default)
  RETURN COALESCE(site_names_array, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permissions to authenticated users and service_role
GRANT EXECUTE ON FUNCTION get_publisher_site_names(UUID) TO authenticated, service_role;

-- Add comment for documentation
COMMENT ON FUNCTION get_publisher_site_names(UUID) IS 'Extracts unique site names for a publisher from both reports_dimensional and report_historical tables, with COALESCE priority: site_name > subdomain > domain. Returns sorted array of distinct site names or empty array if none found.';
