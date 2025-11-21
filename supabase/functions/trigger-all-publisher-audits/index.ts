import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { v4 as uuidv4 } from "npm:uuid@9.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TriggerAllResponse {
  success: boolean;
  totalPublishers: number;
  queuedPublishers: number;
  failedPublishers: number;
  results: Array<{
    publisherId: string;
    publisherName: string;
    status: 'queued' | 'failed';
    error?: string;
  }>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const requestId = uuidv4();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const workerUrl = Deno.env.get("SITE_MONITOR_WORKER_URL");
    const workerSecret = Deno.env.get("WORKER_SECRET");

    if (!workerUrl) {
      console.error(`[${requestId}] SITE_MONITOR_WORKER_URL not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Site monitoring worker URL is not configured",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const client = createClient(supabaseUrl, supabaseKey);

    console.log(`[${requestId}] Starting trigger all publisher audits with worker URL: ${workerUrl}`);

    // Get all enabled publishers
    const { data: publishers, error: publisherError } = await client
      .from("publishers")
      .select("id, name, domain, network_code")
      .not("gam_status", "is", null)
      .order("created_at", { ascending: false });

    if (publisherError) {
      console.error(`[${requestId}] Error fetching publishers:`, publisherError);
      return new Response(
        JSON.stringify({
          success: false,
          error: publisherError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const enabledPublishers = publishers || [];
    console.log(`[${requestId}] Found ${enabledPublishers.length} publishers`);

    const results: TriggerAllResponse["results"] = [];
    let queuedCount = 0;
    let failedCount = 0;

    // Process each publisher with rate limiting
    for (let i = 0; i < enabledPublishers.length; i++) {
      const publisher = enabledPublishers[i];
      console.log(
        `[${requestId}] Processing publisher ${i + 1}/${enabledPublishers.length}: ${publisher.name}`
      );

      try {
        // Fetch site names for this publisher
        const { data: siteNamesData, error: siteNamesError } = await client.rpc(
          "get_publisher_site_names",
          { p_publisher_id: publisher.id }
        );

        if (siteNamesError) {
          console.warn(
            `[${requestId}] Error fetching site names for ${publisher.id}:`,
            siteNamesError
          );
          results.push({
            publisherId: publisher.id,
            publisherName: publisher.name,
            status: "failed",
            error: `Failed to fetch site names: ${siteNamesError.message}`,
          });
          failedCount++;
          continue;
        }

        const siteNames: string[] = Array.isArray(siteNamesData)
          ? (siteNamesData as any[])
              .map((item: any) => item.site_name)
              .filter((name: string) => name && typeof name === "string")
          : ["primary"];

        if (siteNames.length === 0) {
          siteNames.push("primary");
        }

        console.log(
          `[${requestId}] Publisher ${publisher.name} has ${siteNames.length} sites: ${siteNames.join(", ")}`
        );

        // Call audit-batch-sites endpoint
        const auditEndpoint = `${supabaseUrl}/functions/v1/audit-batch-sites`;
        const auditPayload = {
          publisher_id: publisher.id,
          site_names: siteNames,
        };

        const auditHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
          "Apikey": supabaseAnonKey,
          "X-Client-Info": "trigger-all-audits/1.0",
        };

        const auditResponse = await fetch(auditEndpoint, {
          method: "POST",
          headers: auditHeaders,
          body: JSON.stringify(auditPayload),
        });

        if (!auditResponse.ok) {
          const errorText = await auditResponse.text();
          console.error(
            `[${requestId}] Audit endpoint error for ${publisher.id}:`,
            auditResponse.status,
            errorText
          );
          results.push({
            publisherId: publisher.id,
            publisherName: publisher.name,
            status: "failed",
            error: `Audit endpoint returned ${auditResponse.status}: ${errorText}`,
          });
          failedCount++;
        } else {
          console.log(
            `[${requestId}] Successfully queued audit for ${publisher.name}`
          );
          results.push({
            publisherId: publisher.id,
            publisherName: publisher.name,
            status: "queued",
          });
          queuedCount++;
        }
      } catch (err) {
        console.error(
          `[${requestId}] Exception processing ${publisher.name}:`,
          err instanceof Error ? err.message : String(err)
        );
        results.push({
          publisherId: publisher.id,
          publisherName: publisher.name,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
        failedCount++;
      }

      // Rate limiting: wait 2-5 seconds between publishers
      if (i < enabledPublishers.length - 1) {
        const delayMs = getRandomDelay(2000, 5000);
        console.log(`[${requestId}] Rate limiting: waiting ${delayMs}ms before next publisher`);
        await sleep(delayMs);
      }
    }

    const response: TriggerAllResponse = {
      success: queuedCount > 0,
      totalPublishers: enabledPublishers.length,
      queuedPublishers: queuedCount,
      failedPublishers: failedCount,
      results,
    };

    console.log(
      `[${requestId}] Completed trigger all audits: ${queuedCount} queued, ${failedCount} failed`
    );

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
