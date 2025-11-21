import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AcceptInviteRequest {
  token?: string;
  password?: string;
}

interface VerifyTokenRequest {
  action: 'verify';
  token: string;
}

interface AcceptInviteWithPasswordRequest {
  action: 'accept';
  token: string;
  password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const requestId = crypto.randomUUID();
  console.log(`\n[ACCEPT-INVITE:${requestId}] Processing invitation acceptance`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log(`[ACCEPT-INVITE:${requestId}] Environment check:`);
    console.log(`[ACCEPT-INVITE:${requestId}] SUPABASE_URL:`, supabaseUrl ? "✓ Set" : "✗ Missing");
    console.log(`[ACCEPT-INVITE:${requestId}] SUPABASE_SERVICE_ROLE_KEY:`, supabaseServiceKey ? "✓ Set" : "✗ Missing");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    });

    console.log(`[ACCEPT-INVITE:${requestId}] Supabase admin client created with service role key`);

    const body = await req.json();
    console.log(`[ACCEPT-INVITE:${requestId}] Request body:`, JSON.stringify(body, null, 2));

    const { action, token, password } = body;

    console.log(`[ACCEPT-INVITE:${requestId}] Parsed parameters:`);
    console.log(`[ACCEPT-INVITE:${requestId}] - action: ${action || "not specified"}`);
    console.log(`[ACCEPT-INVITE:${requestId}] - token: ${token ? `${token.substring(0, 8)}...` : "missing"}`);
    console.log(`[ACCEPT-INVITE:${requestId}] - password: ${password ? "provided" : "not provided"}`);

    if (!token) {
      console.error(`[ACCEPT-INVITE:${requestId}] Missing token`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Token is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === 'verify') {
      console.log(`[ACCEPT-INVITE:${requestId}] ACTION: Verifying token...`);
      console.log(`[ACCEPT-INVITE:${requestId}] Querying invitations table with token: ${token.substring(0, 8)}...`);

      const { data: invite, error: inviteError } = await supabaseAdmin
        .from("invitations")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .maybeSingle();

      console.log(`[ACCEPT-INVITE:${requestId}] Query result:`, {
        found: !!invite,
        error: inviteError ? inviteError.message : null,
        inviteData: invite ? { id: invite.id, email: invite.email, status: invite.status } : null,
      });

      if (inviteError) {
        console.error(`[ACCEPT-INVITE:${requestId}] Database error during token lookup:`, inviteError);
        console.error(`[ACCEPT-INVITE:${requestId}] Error code:`, inviteError.code);
        console.error(`[ACCEPT-INVITE:${requestId}] Error details:`, inviteError.details);

        let errorMessage = "Database error while verifying token";
        if (inviteError.message && inviteError.message.toLowerCase().includes("permission denied")) {
          errorMessage = "Supabase RLS is blocking the invitations query. Ensure you use service_role key.";
          console.error(`[ACCEPT-INVITE:${requestId}] RLS BLOCKING ERROR DETECTED!`);
          console.error(`[ACCEPT-INVITE:${requestId}] Service role key being used: ${supabaseServiceKey ? "YES" : "NO"}`);
        }

        return new Response(
          JSON.stringify({
            success: false,
            valid: false,
            error: errorMessage,
            details: inviteError.message,
            code: inviteError.code,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!invite) {
        console.error(`[ACCEPT-INVITE:${requestId}] No invitation found with token: ${token.substring(0, 8)}...`);
        console.log(`[ACCEPT-INVITE:${requestId}] Checking if token exists with any status...`);

        const { data: anyInvite } = await supabaseAdmin
          .from("invitations")
          .select("status, expires_at")
          .eq("token", token)
          .maybeSingle();

        if (anyInvite) {
          console.log(`[ACCEPT-INVITE:${requestId}] Token found with status: ${anyInvite.status}`);
          if (anyInvite.status === "accepted") {
            return new Response(
              JSON.stringify({
                success: false,
                valid: false,
                error: "This invitation has already been used",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          } else if (anyInvite.status === "expired") {
            return new Response(
              JSON.stringify({
                success: false,
                valid: false,
                error: "This invitation has expired",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        } else {
          console.log(`[ACCEPT-INVITE:${requestId}] Token not found in database at all`);
        }

        return new Response(
          JSON.stringify({
            success: false,
            valid: false,
            error: "Invalid invitation token",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`[ACCEPT-INVITE:${requestId}] Found invitation:`, {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expires_at: invite.expires_at,
      });

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        console.log(`[ACCEPT-INVITE:${requestId}] Token expired at ${invite.expires_at}`);

        await supabaseAdmin
          .from("invitations")
          .update({ status: "expired" })
          .eq("id", invite.id);

        console.log(`[ACCEPT-INVITE:${requestId}] Marked invitation as expired`);

        return new Response(
          JSON.stringify({
            success: false,
            valid: false,
            error: "This invitation has expired. Please request a new one.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`[ACCEPT-INVITE:${requestId}] ✓ Token is valid and not expired`);

      return new Response(
        JSON.stringify({
          success: true,
          valid: true,
          invitation: {
            email: invite.email,
            role: invite.role,
            metadata: invite.metadata,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!password) {
      console.error(`[ACCEPT-INVITE:${requestId}] Missing password`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Password is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (password.length < 8) {
      console.error(`[ACCEPT-INVITE:${requestId}] Password too short`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Password must be at least 8 characters long",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[ACCEPT-INVITE:${requestId}] ACTION: Accepting invitation with password...`);
    console.log(`[ACCEPT-INVITE:${requestId}] Looking up invitation by token: ${token.substring(0, 8)}...`);

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    console.log(`[ACCEPT-INVITE:${requestId}] Query result:`, {
      found: !!invite,
      error: inviteError ? inviteError.message : null,
      inviteData: invite ? { id: invite.id, email: invite.email, status: invite.status } : null,
    });

    if (inviteError) {
      console.error(`[ACCEPT-INVITE:${requestId}] Database error during token lookup:`, inviteError);
      console.error(`[ACCEPT-INVITE:${requestId}] Error code:`, inviteError.code);
      console.error(`[ACCEPT-INVITE:${requestId}] Error details:`, inviteError.details);

      let errorMessage = "Failed to retrieve invitation";
      if (inviteError.message && inviteError.message.toLowerCase().includes("permission denied")) {
        errorMessage = "Supabase RLS is blocking the invitations query. Ensure you use service_role key.";
        console.error(`[ACCEPT-INVITE:${requestId}] RLS BLOCKING ERROR DETECTED!`);
        console.error(`[ACCEPT-INVITE:${requestId}] Service role key being used: ${supabaseServiceKey ? "YES" : "NO"}`);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          details: inviteError.message,
          code: inviteError.code,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!invite) {
      console.error(`[ACCEPT-INVITE:${requestId}] No invitation found with token: ${token.substring(0, 8)}...`);
      console.log(`[ACCEPT-INVITE:${requestId}] Checking if token exists with any status...`);

      const { data: anyInvite } = await supabaseAdmin
        .from("invitations")
        .select("status, expires_at")
        .eq("token", token)
        .maybeSingle();

      if (anyInvite) {
        console.log(`[ACCEPT-INVITE:${requestId}] Token found with status: ${anyInvite.status}`);
        if (anyInvite.status === "accepted") {
          return new Response(
            JSON.stringify({
              success: false,
              error: "This invitation has already been used",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } else if (anyInvite.status === "expired") {
          return new Response(
            JSON.stringify({
              success: false,
              error: "This invitation has expired",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } else if (anyInvite.status === "cancelled") {
          return new Response(
            JSON.stringify({
              success: false,
              error: "This invitation has been cancelled",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else {
        console.log(`[ACCEPT-INVITE:${requestId}] Token not found in database at all`);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid invitation token",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[ACCEPT-INVITE:${requestId}] Found invitation:`, {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expires_at: invite.expires_at,
    });

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      console.log(`[ACCEPT-INVITE:${requestId}] Invitation has expired at ${invite.expires_at}`);

      await supabaseAdmin
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invite.id);

      console.log(`[ACCEPT-INVITE:${requestId}] Marked invitation as expired`);

      return new Response(
        JSON.stringify({
          success: false,
          error: "This invitation has expired. Please request a new one.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    function isValidUuid(uuid: string | undefined): boolean {
      if (!uuid) return false;
      const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return regex.test(uuid);
    }

    console.log(`[ACCEPT-INVITE:${requestId}] Creating user account...`);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: invite.metadata?.full_name || invite.email.split("@")[0],
        company_name: invite.metadata?.company_name,
      },
    });

    if (authError || !authData.user) {
      console.error(`[ACCEPT-INVITE:${requestId}] Failed to create user:`, authError);
      console.error(`[ACCEPT-INVITE:${requestId}] Error stack:`, authError?.stack);

      await supabaseAdmin.from("email_logs").insert({
        email: invite.email,
        subject: "Invitation Acceptance Failed",
        status: "failed",
        error_message: `User creation failed: ${authError?.message}`,
        email_type: "invitation_acceptance",
        metadata: {
          invitation_id: invite.id,
          error: authError?.message,
          stack: authError?.stack,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create user account",
          details: authError?.message,
          stack: authError?.stack,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = authData.user.id;
    console.log(`[ACCEPT-INVITE:${requestId}] User created - ID: ${userId}, Email: ${authData.user.email}`);

    console.log(`[ACCEPT-INVITE:${requestId}] Validating user ID format...`);
    if (!isValidUuid(userId)) {
      console.error(`[ACCEPT-INVITE:${requestId}] ❌ INVALID USER ID RETURNED: "${userId}"`);
      console.error(`[ACCEPT-INVITE:${requestId}] User ID type: ${typeof userId}`);
      console.error(`[ACCEPT-INVITE:${requestId}] User ID value: ${JSON.stringify(userId)}`);

      console.log(`[ACCEPT-INVITE:${requestId}] Rolling back: Attempting to delete invalid auth user...`);
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.log(`[ACCEPT-INVITE:${requestId}] ✅ Rollback complete: Invalid auth user deleted`);
      } catch (deleteError) {
        console.error(`[ACCEPT-INVITE:${requestId}] ⚠️ Failed to delete invalid auth user:`, deleteError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid user ID returned from auth system: ${userId}`,
          details: `User ID validation failed. Expected valid UUID, got: ${typeof userId} - ${userId}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[ACCEPT-INVITE:${requestId}] ✅ User ID validation passed: ${userId}`);

    console.log(`[ACCEPT-INVITE:${requestId}] Creating app_users record...`);
    console.log(`[ACCEPT-INVITE:${requestId}] Using service role key: ${supabaseServiceKey ? 'YES' : 'NO'}`);

    const fullName = invite.metadata?.full_name || invite.email.split("@")[0];
    const invitedBy = invite.invited_by ? invite.invited_by : null;

    const appUserData = {
      id: userId,
      email: invite.email,
      full_name: fullName,
      role: invite.role,
      status: "active",
      company_name: invite.metadata?.company_name || null,
      invited_by: invitedBy,
    };

    console.log(`[ACCEPT-INVITE:${requestId}] Profile data to upsert:`, JSON.stringify(appUserData, null, 2));

    const { data: insertedUser, error: appUserError } = await supabaseAdmin
      .from("app_users")
      .upsert(appUserData, { onConflict: 'id' })
      .select()
      .single();

    if (appUserError) {
      console.error(`[ACCEPT-INVITE:${requestId}] ❌ Failed to create app_users record`);
      console.error(`[ACCEPT-INVITE:${requestId}] Error code: ${appUserError.code}`);
      console.error(`[ACCEPT-INVITE:${requestId}] Error message: ${appUserError.message}`);
      console.error(`[ACCEPT-INVITE:${requestId}] Error hint: ${appUserError.hint || 'none'}`);
      console.error(`[ACCEPT-INVITE:${requestId}] Error details:`, JSON.stringify(appUserError.details || {}, null, 2));
      console.error(`[ACCEPT-INVITE:${requestId}] Full error object:`, JSON.stringify(appUserError, null, 2));
      console.error(`[ACCEPT-INVITE:${requestId}] Error stack:`, appUserError.stack);

      console.log(`[ACCEPT-INVITE:${requestId}] Rolling back: Deleting auth user ${userId}...`);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      console.log(`[ACCEPT-INVITE:${requestId}] ✅ Rollback complete: Auth user ${userId} deleted`);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create user profile: ${appUserError.message}`,
          details: appUserError.message,
          code: appUserError.code,
          hint: appUserError.hint,
          stack: appUserError.stack,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[ACCEPT-INVITE:${requestId}] ✅ app_users record created successfully`);
    console.log(`[ACCEPT-INVITE:${requestId}] Inserted user data:`, JSON.stringify(insertedUser, null, 2));

    console.log(`[ACCEPT-INVITE:${requestId}] Marking invitation as accepted...`);
    const { error: inviteUpdateError } = await supabaseAdmin
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (inviteUpdateError) {
      console.error(`[ACCEPT-INVITE:${requestId}] ⚠️ Failed to mark invitation as accepted:`, inviteUpdateError.message);
    } else {
      console.log(`[ACCEPT-INVITE:${requestId}] ✅ Invitation marked as accepted`);
    }

    console.log(`[ACCEPT-INVITE:${requestId}] Creating audit log entry...`);
    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      user_email: invite.email,
      user_role: invite.role,
      action: "invitation_accepted",
      entity_type: "invitations",
      entity_id: invite.id,
      details: {
        email: invite.email,
        role: invite.role,
        invited_by: invite.invited_by,
      },
    });

    if (auditError) {
      console.error(`[ACCEPT-INVITE:${requestId}] ⚠️ Failed to create audit log:`, auditError.message);
    } else {
      console.log(`[ACCEPT-INVITE:${requestId}] ✅ Audit log created`);
    }

    console.log(`[ACCEPT-INVITE:${requestId}] 🎉 Invitation accepted successfully - All steps completed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation accepted successfully",
        user_id: userId,
        email: invite.email,
        role: invite.role,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`[ACCEPT-INVITE:${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
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