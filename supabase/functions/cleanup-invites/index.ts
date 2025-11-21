import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("[CLEANUP-INVITES] Starting cleanup process");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expiredInvites, error: selectError } = await supabaseAdmin
      .from("invitations")
      .select("id, email, created_at, expires_at")
      .eq("status", "pending")
      .or(`expires_at.lt.${new Date().toISOString()},created_at.lt.${sevenDaysAgo}`);

    if (selectError) {
      console.error("[CLEANUP-INVITES] Error selecting expired invites:", selectError);
      throw selectError;
    }

    if (!expiredInvites || expiredInvites.length === 0) {
      console.log("[CLEANUP-INVITES] No expired invitations found");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No expired invitations to clean up",
          cleaned: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[CLEANUP-INVITES] Found ${expiredInvites.length} expired invitations`);

    const { error: updateError } = await supabaseAdmin
      .from("invitations")
      .update({ status: "expired" })
      .in("id", expiredInvites.map((inv) => inv.id));

    if (updateError) {
      console.error("[CLEANUP-INVITES] Error updating invitations:", updateError);
      throw updateError;
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: null,
      user_email: "system",
      user_role: "system",
      action: "invitations_cleanup",
      entity_type: "invitations",
      entity_id: "bulk",
      details: {
        cleaned_count: expiredInvites.length,
        emails: expiredInvites.map((inv) => inv.email),
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`[CLEANUP-INVITES] Successfully cleaned ${expiredInvites.length} invitations`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully expired ${expiredInvites.length} old invitations`,
        cleaned: expiredInvites.length,
        invitations: expiredInvites.map((inv) => ({
          email: inv.email,
          created_at: inv.created_at,
          expires_at: inv.expires_at,
        })),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[CLEANUP-INVITES] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
