import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callWorkerWithResilience, logColdStart } from "../_shared/worker-resilience.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const requestId = `scheduled-${Date.now()}`;

  try {
    console.log(`[${requestId}] 🕐 Scheduled GAM reports fetch triggered`);

    const RENDER_WORKER_URL = Deno.env.get('RENDER_WORKER_URL');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RENDER_WORKER_URL) {
      throw new Error('RENDER_WORKER_URL environment variable not set');
    }

    console.log(`[${requestId}] 📡 Triggering worker with resilience handling`);

    const result = await callWorkerWithResilience({
      workerUrl: RENDER_WORKER_URL,
      endpoint: '/fetch-reports',
      requestId,
      body: {
        triggered_by: 'pg_cron_scheduled_edge_function',
      },
    });

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      await logColdStart(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        worker_name: 'gam-reports-worker',
        request_id: requestId,
        cold_start: result.coldStart,
        duration_ms: result.totalDuration,
        attempts: result.attempts,
        success: result.success,
        error_message: result.error,
      });
    }

    if (!result.success) {
      throw new Error(result.error || 'Worker call failed');
    }

    console.log(`[${requestId}] ✅ Worker triggered successfully after ${result.attempts} attempt(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scheduled GAM reports fetch triggered successfully',
        workerResponse: result.data,
        coldStart: result.coldStart,
        attempts: result.attempts,
        durationMs: result.totalDuration,
        triggeredAt: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error(`[${requestId}] ❌ Error triggering scheduled GAM reports fetch:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        triggeredAt: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});