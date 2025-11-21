import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AuditJobQueue {
  id: string;
  publisher_id: string;
  sites: Array<{ name: string; url: string }>;
  status: string;
  queued_at: string;
}

interface WorkerCallOptions {
  workerUrl: string;
  endpoint: string;
  requestId: string;
  body?: Record<string, unknown>;
  method?: 'GET' | 'POST';
  maxRetries?: number;
  initialTimeout?: number;
  retryDelays?: number[];
  workerSecret?: string;
}

interface WorkerCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  attempts: number;
  coldStart: boolean;
  totalDuration: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function addJitter(ms: number, jitterPercent: number = 0.1): number {
  const jitterAmount = ms * jitterPercent;
  return ms + (Math.random() * jitterAmount * 2 - jitterAmount);
}

async function callWorkerWithResilience(
  options: WorkerCallOptions
): Promise<WorkerCallResult> {
  const {
    workerUrl,
    endpoint,
    requestId,
    body = {},
    method = 'POST',
    maxRetries = 3,
    initialTimeout = 120000,
    retryDelays = [10000, 20000, 40000],
    workerSecret,
  } = options;

  const cleanWorkerUrl = workerUrl.endsWith('/') ? workerUrl.slice(0, -1) : workerUrl;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${cleanWorkerUrl}${cleanEndpoint}`;
  const startTime = Date.now();
  let lastError: Error | null = null;
  let coldStart = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${requestId}] Attempt ${attempt}/${maxRetries}: Calling ${fullUrl}`);

      const attemptStartTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), initialTimeout);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (workerSecret) {
        headers['Authorization'] = `Bearer ${workerSecret}`;
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (method === 'POST') {
        fetchOptions.body = JSON.stringify({
          ...body,
          request_id: requestId,
        });
      }

      const response = await fetch(fullUrl, fetchOptions);

      clearTimeout(timeoutId);
      const attemptDuration = Date.now() - attemptStartTime;

      if (attemptDuration > 5000 && attempt === 1) {
        coldStart = true;
        console.log(`[${requestId}] Cold start detected (${attemptDuration}ms)`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Worker responded with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const totalDuration = Date.now() - startTime;

      console.log(`[${requestId}] Success on attempt ${attempt} (${attemptDuration}ms, total: ${totalDuration}ms)`);

      return {
        success: true,
        data,
        attempts: attempt,
        coldStart,
        totalDuration,
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const attemptDuration = Date.now() - startTime;

      console.error(`[${requestId}] Attempt ${attempt} failed after ${attemptDuration}ms:`, lastError.message);

      if (attempt < maxRetries) {
        const baseDelay = retryDelays[attempt - 1] || 10000;
        const delayWithJitter = addJitter(baseDelay, 0.2);
        const delayMs = Math.ceil(delayWithJitter);
        console.log(`[${requestId}] Waiting ${delayMs}ms before retry ${attempt + 1}...`);
        await sleep(delayMs);
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  console.error(`[${requestId}] All ${maxRetries} attempts failed. Total duration: ${totalDuration}ms`);

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    attempts: maxRetries,
    coldStart,
    totalDuration,
  };
}

async function logColdStart(
  supabaseUrl: string,
  supabaseKey: string,
  data: {
    worker_name: string;
    request_id: string;
    cold_start: boolean;
    duration_ms: number;
    attempts: number;
    success: boolean;
    error_message?: string;
  }
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/worker_cold_starts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Failed to log cold start:', error);
  }
}

async function triggerSiteAudit(
  requestId: string,
  publisherId: string,
  auditJobEntry: AuditJobQueue,
  SITE_MONITOR_WORKER_URL: string,
  WORKER_SECRET?: string
): Promise<{
  success: boolean;
  error?: string;
  siteAuditTriggered: boolean;
}> {
  try {
    if (!SITE_MONITOR_WORKER_URL) {
      console.warn(`[${requestId}] Site monitoring worker URL not configured, skipping site audit trigger`);
      return { success: true, siteAuditTriggered: false };
    }

    console.log(`[${requestId}] Triggering site audit for publisher ${publisherId} with job ID ${auditJobEntry.id}`);

    const sites = Array.isArray(auditJobEntry.sites) ? auditJobEntry.sites : [];
    const siteNames = sites
      .map(site => (typeof site === 'string' ? site : site.name || site.url))
      .filter(Boolean);

    console.log(`[${requestId}] Extracted ${siteNames.length} site name(s) from audit job queue: ${JSON.stringify(sites)}`);
    console.log(`[${requestId}] Processed site names: ${siteNames.join(', ')}`);

    if (siteNames.length === 0) {
      console.warn(`[${requestId}] No sites found in audit job queue entry, cannot trigger site audit`);
      return { success: true, siteAuditTriggered: false };
    }

    console.log(`[${requestId}] Site audit will process ${siteNames.length} site(s): ${siteNames.join(', ')}`);

    console.log(`[${requestId}] Calling /audit-batch-sites endpoint with publisherId=${publisherId}, domain=${siteNames[0]}, siteCount=${siteNames.length}`);

    const result = await callWorkerWithResilience({
      workerUrl: SITE_MONITOR_WORKER_URL,
      endpoint: "/audit-batch-sites",
      requestId: `${requestId}-site-audit`,
      body: {
        publisher_id: publisherId,
        site_names: siteNames,
      },
      workerSecret: WORKER_SECRET,
      maxRetries: 2,
      initialTimeout: 60000,
      retryDelays: [5000, 10000],
    });

    console.log(`[${requestId}] Site audit call result: success=${result.success}, attempts=${result.attempts}, duration=${result.totalDuration}ms`);

    if (!result.success) {
      console.warn(
        `[${requestId}] Site audit trigger failed after ${result.attempts} attempt(s): ${result.error}. Will continue in background.`
      );
      return {
        success: true,
        siteAuditTriggered: false,
        error: result.error,
      };
    }

    console.log(`[${requestId}] Successfully triggered site audit for publisher ${publisherId}`);
    return { success: true, siteAuditTriggered: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Error triggering site audit:`, errorMessage);
    return {
      success: true,
      siteAuditTriggered: false,
      error: errorMessage,
    };
  }
}

async function fetchAuditJobQueue(
  requestId: string,
  publisherId: string,
  SUPABASE_URL: string,
  SUPABASE_SERVICE_ROLE_KEY: string
): Promise<AuditJobQueue | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("audit_job_queue")
      .select("id, publisher_id, sites, status, queued_at")
      .eq("publisher_id", publisherId)
      .eq("status", "pending")
      .order("queued_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[${requestId}] Error querying audit_job_queue:`, error.message);
      return null;
    }

    if (data) {
      console.log(`[${requestId}] Found pending audit job: ${data.id} with status ${data.status}`);
      return data as AuditJobQueue;
    }

    console.warn(`[${requestId}] No pending audit job found for publisher ${publisherId}`);
    return null;
  } catch (error) {
    console.error(`[${requestId}] Exception fetching audit_job_queue:`, error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const requestId = `new-pub-${Date.now()}`;

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Only POST requests are supported",
          requestId,
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();
    const { publisherId } = body;

    if (!publisherId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "publisherId is required in request body",
          requestId,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(`[${requestId}] New publisher GAM report triggered for publisher: ${publisherId}`);

    const RENDER_WORKER_URL = Deno.env.get("RENDER_WORKER_URL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SITE_MONITOR_WORKER_URL = Deno.env.get("SITE_MONITOR_WORKER_URL");
    const WORKER_SECRET = Deno.env.get("WORKER_SECRET");

    if (!RENDER_WORKER_URL) {
      throw new Error("RENDER_WORKER_URL environment variable not set");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables not set");
    }

    console.log(`[${requestId}] Triggering worker to fetch last 2 months of data`);

    const result = await callWorkerWithResilience({
      workerUrl: RENDER_WORKER_URL,
      endpoint: "/fetch-historical-reports",
      requestId,
      body: {
        publisherId,
        triggered_by: "new_publisher_edge_function",
      },
    });

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      await logColdStart(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        worker_name: "gam-reports-worker-historical",
        request_id: requestId,
        cold_start: result.coldStart,
        duration_ms: result.totalDuration,
        attempts: result.attempts,
        success: result.success,
        error_message: result.error,
      });
    }

    if (!result.success) {
      console.warn(
        `[${requestId}] Warning: Worker call failed after ${result.attempts} attempt(s): ${result.error}`
      );
    } else {
      console.log(
        `[${requestId}] Historical report fetch initiated successfully after ${result.attempts} attempt(s)`
      );
    }

    let siteAuditTriggered = false;
    let siteAuditError = null;

    if (result.success) {
      console.log(`[${requestId}] GAM report fetch succeeded, waiting for audit job queue entry to be saved...`);

      let auditJob: AuditJobQueue | null = null;
      let retries = 0;
      const maxWaitRetries = 5;

      while (!auditJob && retries < maxWaitRetries) {
        const backoffDelays = [500, 1000, 1500, 2000, 2500];
        const delayMs = backoffDelays[retries] || 2500;
        await sleep(delayMs);
        auditJob = await fetchAuditJobQueue(requestId, publisherId, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        retries++;

        if (auditJob) {
          console.log(`[${requestId}] Found audit job queue entry after ${retries} attempt(s) with backoff delays`);
        } else if (retries < maxWaitRetries) {
          console.log(`[${requestId}] Audit job queue entry not yet available, retrying (${retries}/${maxWaitRetries})...`);
        }
      }

      if (auditJob) {
        console.log(`[${requestId}] Audit job ID: ${auditJob.id} retrieved, triggering site audit...`);
        const siteAuditResult = await triggerSiteAudit(
          requestId,
          publisherId,
          auditJob,
          SITE_MONITOR_WORKER_URL || "",
          WORKER_SECRET
        );

        siteAuditTriggered = siteAuditResult.siteAuditTriggered;
        siteAuditError = siteAuditResult.error;

        console.log(`[${requestId}] Site audit trigger result: triggered=${siteAuditTriggered}, error=${siteAuditError || 'none'}`);

        if (!siteAuditTriggered && siteAuditError) {
          console.warn(`[${requestId}] Site audit trigger encountered issue: ${siteAuditError}. Continuing in background.`);
        } else if (siteAuditTriggered) {
          console.log(`[${requestId}] Site audit successfully queued in worker for publisher ${publisherId}`);
        }
      } else {
        console.warn(`[${requestId}] Audit job queue entry was not found after ${maxWaitRetries} attempts. Site audit will not be triggered but GAM data was fetched successfully.`);
      }
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.success
          ? "Historical GAM report fetch initiated for new publisher"
          : "Historical fetch encountered issues but will continue in background",
        publisherId,
        requestId,
        workerResponse: result.data,
        coldStart: result.coldStart,
        attempts: result.attempts,
        durationMs: result.totalDuration,
        siteAudit: {
          triggered: siteAuditTriggered,
          error: siteAuditError,
        },
        triggeredAt: new Date().toISOString(),
      }),
      {
        status: result.success ? 200 : 202,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      `[${requestId}] Error triggering new publisher GAM report fetch:`,
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
        triggeredAt: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});