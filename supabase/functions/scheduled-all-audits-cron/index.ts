import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PublisherRecord {
  id: string;
  name: string;
  domain?: string;
  network_code?: string;
  enabled?: boolean;
}

interface AuditFailureRecord {
  id: string;
  publisher_id: string;
  failure_timestamp: string;
  reason?: string;
}

interface CronExecutionResult {
  success: boolean;
  requestId: string;
  totalPublishers: number;
  queuedCount: number;
  failedCount: number;
  skippedCount: number;
  durationMs: number;
  executionStatus: 'success' | 'partial' | 'failed';
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function checkCircuitBreaker(
  supabase: any,
  publisherId: string,
  requestId: string
): Promise<{ isTripped: boolean; reason?: string }> {
  try {
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: failures, error } = await supabase
      .from('audit_failures')
      .select('id')
      .eq('publisher_id', publisherId)
      .gte('failure_timestamp', sixtyMinutesAgo);

    if (error) {
      console.warn(`[${requestId}] Error checking circuit breaker for ${publisherId}:`, error.message);
      return { isTripped: false };
    }

    const failureCount = failures?.length || 0;
    if (failureCount >= 3) {
      console.log(`[${requestId}] Circuit breaker TRIPPED for publisher ${publisherId}: ${failureCount} failures in last 60 minutes`);
      return {
        isTripped: true,
        reason: `3+ audit failures in last 60 minutes (${failureCount} failures)`
      };
    }

    return { isTripped: false };
  } catch (err) {
    console.error(`[${requestId}] Exception checking circuit breaker:`, err instanceof Error ? err.message : String(err));
    return { isTripped: false };
  }
}

async function logAdminAlert(
  supabase: any,
  alertType: string,
  publisherId: string,
  message: string,
  requestId: string
): Promise<void> {
  try {
    await supabase.from('admin_alerts').insert({
      alert_type: alertType,
      publisher_id: publisherId,
      subject: alertType,
      message: message,
      metadata: { request_id: requestId },
    });
  } catch (err) {
    console.warn(`[${requestId}] Failed to log admin alert:`, err instanceof Error ? err.message : String(err));
  }
}

async function callAuditBatchEndpoint(
  supabaseUrl: string,
  supabaseAnonKey: string,
  publisherId: string,
  siteNames: string[],
  requestId: string,
  workerSecret?: string
): Promise<{ success: boolean; error?: string }> {
  const maxRetries = 3;
  const baseDelayMs = 1000;
  const timeoutMs = 30000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const auditEndpoint = `${supabaseUrl}/functions/v1/audit-batch-sites`;
      const auditPayload = {
        publisher_id: publisherId,
        site_names: siteNames,
      };

      const auditHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const auditResponse = await fetch(auditEndpoint, {
        method: 'POST',
        headers: auditHeaders,
        body: JSON.stringify(auditPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (auditResponse.ok) {
        console.log(`[${requestId}] Successfully queued audit for publisher ${publisherId} (attempt ${attempt})`);
        return { success: true };
      }

      const errorText = await auditResponse.text();
      console.warn(`[${requestId}] Audit endpoint returned ${auditResponse.status} (attempt ${attempt}):`, errorText);

      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`[${requestId}] Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[${requestId}] Attempt ${attempt} failed:`, errorMsg);

      if (attempt < maxRetries && !errorMsg.includes('AbortError')) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        await sleep(delayMs);
      }
    }
  }

  return { success: false, error: 'Failed after 3 retry attempts' };
}

async function fetchPublisherSiteNames(
  supabase: any,
  publisherId: string,
  requestId: string
): Promise<string[]> {
  try {
    const { data: siteNamesData, error } = await supabase.rpc('get_publisher_site_names', {
      p_publisher_id: publisherId,
    });

    if (error) {
      console.warn(`[${requestId}] Error fetching site names for ${publisherId}:`, error.message);
      return [];
    }

    if (!Array.isArray(siteNamesData) || siteNamesData.length === 0) {
      console.log(`[${requestId}] No site names found for publisher ${publisherId}`);
      return [];
    }

    const siteNames = siteNamesData
      .map((item: any) => item.site_name)
      .filter((name: string) => name && typeof name === 'string' && name.trim().length > 0);

    if (siteNames.length === 0) {
      console.log(`[${requestId}] All site names were empty for publisher ${publisherId}`);
      return [];
    }

    console.log(`[${requestId}] Found ${siteNames.length} site names for publisher ${publisherId}`);
    return siteNames;
  } catch (err) {
    console.error(
      `[${requestId}] Exception fetching site names for ${publisherId}:`,
      err instanceof Error ? err.message : 'Unknown error'
    );
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const executionStartTime = Date.now();
  const requestId = `cron-${executionStartTime}`;
  let executionLog = null;

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const workerSecret = Deno.env.get('WORKER_SECRET');

    const supabase = createClient(supabaseUrl, supabaseKey);
    const startedAt = new Date().toISOString();

    console.log(`[${requestId}] Starting scheduled daily cron audit execution at ${startedAt}`);

    // Fetch all enabled publishers
    const { data: publishers, error: publisherError } = await supabase
      .from('publishers')
      .select('id, name, domain, network_code, enabled')
      .eq('enabled', true)
      .order('created_at', { ascending: false });

    if (publisherError) {
      console.error(`[${requestId}] Error fetching publishers:`, publisherError);
      throw new Error(`Failed to fetch publishers: ${publisherError.message}`);
    }

    const activePublishers = (publishers || []) as PublisherRecord[];
    const totalPublishers = activePublishers.length;

    console.log(`[${requestId}] Found ${totalPublishers} enabled publishers`);

    // Create execution log entry
    const { data: logEntry, error: logError } = await supabase
      .from('cron_execution_logs')
      .insert({
        request_id: requestId,
        cron_job_name: 'scheduled-all-audits-cron',
        execution_date: new Date().toISOString().split('T')[0],
        total_publishers: totalPublishers,
        queued_count: 0,
        failed_count: 0,
        skipped_count: 0,
        duration_seconds: 0,
        started_at: startedAt,
        execution_status: 'partial',
      })
      .select('id')
      .single();

    if (logError) {
      console.warn(`[${requestId}] Failed to create execution log entry:`, logError.message);
    } else {
      executionLog = logEntry;
      console.log(`[${requestId}] Created execution log entry`);
    }

    let queuedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const results: Array<{ publisherId: string; status: string; reason?: string }> = [];

    // Process each active publisher
    for (let i = 0; i < activePublishers.length; i++) {
      const publisher = activePublishers[i];
      console.log(`[${requestId}] Processing publisher ${i + 1}/${activePublishers.length}: ${publisher.name}`);

      try {
        // Check circuit breaker
        const circuitBreakerCheck = await checkCircuitBreaker(supabase, publisher.id, requestId);
        if (circuitBreakerCheck.isTripped) {
          console.log(`[${requestId}] Skipping publisher ${publisher.name} - circuit breaker triggered`);
          await logAdminAlert(
            supabase,
            'circuit_breaker_skip',
            publisher.id,
            `Publisher ${publisher.name} skipped due to circuit breaker: ${circuitBreakerCheck.reason}`,
            requestId
          );
          skippedCount++;
          results.push({
            publisherId: publisher.id,
            status: 'skipped',
            reason: circuitBreakerCheck.reason,
          });
          continue;
        }

        // Fetch site names
        const siteNames = await fetchPublisherSiteNames(supabase, publisher.id, requestId);
        if (siteNames.length === 0) {
          console.warn(`[${requestId}] No site names found for publisher ${publisher.name}, skipping`);
          await logAdminAlert(
            supabase,
            'site_skip',
            publisher.id,
            `Publisher ${publisher.name} skipped - no site names available`,
            requestId
          );
          skippedCount++;
          results.push({
            publisherId: publisher.id,
            status: 'skipped',
            reason: 'No site names available',
          });
          continue;
        }

        // Call audit batch endpoint with retry logic
        const auditResult = await callAuditBatchEndpoint(
          supabaseUrl,
          supabaseAnonKey,
          publisher.id,
          siteNames,
          requestId,
          workerSecret
        );

        if (auditResult.success) {
          queuedCount++;
          results.push({
            publisherId: publisher.id,
            status: 'queued',
          });
        } else {
          failedCount++;
          results.push({
            publisherId: publisher.id,
            status: 'failed',
            reason: auditResult.error,
          });
          await logAdminAlert(
            supabase,
            'audit_failure',
            publisher.id,
            `Failed to queue audit for publisher ${publisher.name}: ${auditResult.error}`,
            requestId
          );
        }
      } catch (err) {
        console.error(
          `[${requestId}] Exception processing publisher ${publisher.name}:`,
          err instanceof Error ? err.message : String(err)
        );
        failedCount++;
        results.push({
          publisherId: publisher.id,
          status: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        });
      }

      // Rate limiting
      if (i < activePublishers.length - 1) {
        const delayMs = getRandomDelay(2000, 5000);
        await sleep(delayMs);
      }
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - executionStartTime;
    const durationSeconds = Math.floor(durationMs / 1000);
    const nextScheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const executionStatus = failedCount === 0 ? 'success' : failedCount > queuedCount ? 'failed' : 'partial';

    console.log(
      `[${requestId}] Cron execution completed: ${queuedCount} queued, ${failedCount} failed, ${skippedCount} skipped in ${durationSeconds}s`
    );

    // Update execution log
    if (executionLog) {
      const { error: updateError } = await supabase
        .from('cron_execution_logs')
        .update({
          queued_count: queuedCount,
          failed_count: failedCount,
          skipped_count: skippedCount,
          duration_seconds: durationSeconds,
          completed_at: completedAt,
          execution_status: executionStatus,
          next_scheduled_time: nextScheduledTime,
          summary_json: {
            request_id: requestId,
            total_publishers: totalPublishers,
            queued_count: queuedCount,
            failed_count: failedCount,
            skipped_count: skippedCount,
            duration_seconds: durationSeconds,
            execution_status: executionStatus,
            results: results,
            completed_at: completedAt,
          },
        })
        .eq('id', executionLog.id);

      if (updateError) {
        console.warn(`[${requestId}] Failed to update execution log:`, updateError.message);
      }
    }

    // Call finalize-cron-execution
    try {
      const finalizeEndpoint = `${supabaseUrl}/functions/v1/finalize-cron-execution`;
      const finalizeResponse = await fetch(finalizeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          cronJobName: 'scheduled-all-audits-cron',
          executionDate: new Date().toISOString().split('T')[0],
        }),
      });

      if (!finalizeResponse.ok) {
        console.warn(`[${requestId}] Finalize endpoint returned ${finalizeResponse.status}`);
      }
    } catch (err) {
      console.warn(
        `[${requestId}] Failed to call finalize endpoint:`,
        err instanceof Error ? err.message : String(err)
      );
    }

    const response: CronExecutionResult = {
      success: failedCount === 0,
      requestId,
      totalPublishers,
      queuedCount,
      failedCount,
      skippedCount,
      durationMs,
      executionStatus,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`[${requestId}] Unhandled error in cron execution:`, error);
    const durationMs = Date.now() - executionStartTime;
    const durationSeconds = Math.floor(durationMs / 1000);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Try to update log with error status
    if (executionLog) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from('cron_execution_logs')
          .update({
            execution_status: 'failed',
            error_message: errorMessage,
            duration_seconds: durationSeconds,
            completed_at: new Date().toISOString(),
          })
          .eq('id', executionLog.id);
      } catch (logErr) {
        console.error(`[${requestId}] Failed to update error log:`, logErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        requestId,
        error: errorMessage,
        durationMs,
        executionStatus: 'failed',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
