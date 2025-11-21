import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface SiteAuditError {
  site_name: string;
  error: string;
  timestamp: string;
}

export interface MultiSiteAuditResult {
  publisherId: string;
  totalSites: number;
  successCount: number;
  failureCount: number;
  sites: Array<{
    name: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
  errors: SiteAuditError[];
}

export async function fetchPublisherSiteNames(
  supabase: SupabaseClient,
  publisherId: string,
  requestId: string
): Promise<string[]> {
  try {
    console.log(`[${requestId}] Fetching site names for publisher ${publisherId}`);

    const { data: siteNamesData, error } = await supabase.rpc('get_publisher_site_names', {
      p_publisher_id: publisherId,
    });

    if (error) {
      console.warn(`[${requestId}] Error fetching site names: ${error.message}`);
      return ['primary'];
    }

    if (!Array.isArray(siteNamesData) || siteNamesData.length === 0) {
      console.log(`[${requestId}] No site names found for publisher ${publisherId}, using default`);
      return ['primary'];
    }

    const siteNames = siteNamesData
      .map((item: any) => item.site_name)
      .filter((name: string) => name && typeof name === 'string' && name.trim().length > 0);

    if (siteNames.length === 0) {
      console.log(`[${requestId}] All site names were empty, using default`);
      return ['primary'];
    }

    console.log(`[${requestId}] Found ${siteNames.length} site names: ${siteNames.join(', ')}`);
    return siteNames;
  } catch (err) {
    console.error(
      `[${requestId}] Exception fetching site names for ${publisherId}:`,
      err instanceof Error ? err.message : 'Unknown error'
    );
    return ['primary'];
  }
}

export async function fetchMultiplePublisherSiteNames(
  supabase: SupabaseClient,
  publisherIds: string[],
  requestId: string
): Promise<Map<string, string[]>> {
  const siteNamesMap = new Map<string, string[]>();

  for (const publisherId of publisherIds) {
    const siteNames = await fetchPublisherSiteNames(supabase, publisherId, requestId);
    siteNamesMap.set(publisherId, siteNames);
  }

  return siteNamesMap;
}

export function chunkSiteNames(siteNames: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < siteNames.length; i += chunkSize) {
    chunks.push(siteNames.slice(i, i + chunkSize));
  }
  return chunks;
}

export function aggregateAuditErrors(
  errors: SiteAuditError[],
  siteName: string
): SiteAuditError {
  return {
    site_name: siteName,
    error: errors.map(e => e.error).join('; '),
    timestamp: new Date().toISOString(),
  };
}

export function createMultiSiteAuditResult(
  publisherId: string,
  siteNames: string[],
  successfulSites: string[],
  failedSites: Array<{ name: string; error: string }>
): MultiSiteAuditResult {
  const errors: SiteAuditError[] = failedSites.map(fs => ({
    site_name: fs.name,
    error: fs.error,
    timestamp: new Date().toISOString(),
  }));

  return {
    publisherId,
    totalSites: siteNames.length,
    successCount: successfulSites.length,
    failureCount: failedSites.length,
    sites: siteNames.map(site => ({
      name: site,
      status: successfulSites.includes(site) ? 'success' : 'failed',
      error: failedSites.find(fs => fs.name === site)?.error,
    })),
    errors,
  };
}
