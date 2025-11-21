import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { v4 as uuidv4 } from "npm:uuid@9.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const requestId = uuidv4();

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
    const { publisher_id, site_names, priority = "normal" } = body;

    if (!publisher_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required field: publisher_id",
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

    if (!site_names || !Array.isArray(site_names) || site_names.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required field: site_names (non-empty array)",
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

    const SITE_MONITOR_WORKER_URL = Deno.env.get("SITE_MONITOR_WORKER_URL");
    const WORKER_SECRET = Deno.env.get("WORKER_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SITE_MONITOR_WORKER_URL) {
      console.error(`[${requestId}] SITE_MONITOR_WORKER_URL not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Site monitoring worker is not configured",
          requestId,
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(
      `[${requestId}] Received batch audit request for publisher ${publisher_id} with ${site_names.length} sites`
    );

    const result = await callWorkerWithResilience({
      workerUrl: SITE_MONITOR_WORKER_URL,
      endpoint: "/audit-batch-sites",
      requestId,
      body: {
        publisher_id,
        site_names,
        priority,
      },
      workerSecret: WORKER_SECRET,
      maxRetries: 2,
      initialTimeout: 120000,
      retryDelays: [10000, 20000],
    });

    console.log(
      `[${requestId}] Worker response: success=${result.success}, attempts=${result.attempts}, duration=${result.totalDuration}ms`
    );

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      await logColdStart(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        worker_name: "site-monitor-worker-batch",
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
        `[${requestId}] Worker call failed after ${result.attempts} attempt(s): ${result.error}`
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "Failed to process batch audit request",
          requestId,
          attempts: result.attempts,
          durationMs: result.totalDuration,
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Batch audit job queued for processing",
        data: result.data,
        requestId,
        attempts: result.attempts,
        durationMs: result.totalDuration,
        coldStart: result.coldStart,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      `[${requestId}] Error processing batch audit request:`,
      error instanceof Error ? error.message : String(error)
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
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
