import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { SMTPClient } from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendInvitationRequest {
  email: string;
  name?: string;
  role: "super_admin" | "admin" | "partner";
  invited_by: string;
  company_name?: string;
  partner_id?: string;
  metadata?: Record<string, any>;
  test_mode?: boolean;
}

interface EmailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
}

function getEmailConfig(): EmailConfig | null {
  const host = Deno.env.get("SMTP_HOST");
  const port = Deno.env.get("SMTP_PORT");
  const username = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("SMTP_FROM") || username;

  console.log("[EMAIL_CONFIG] Checking SMTP configuration...");
  console.log("[EMAIL_CONFIG] SMTP_HOST:", host ? "✓ Set" : "✗ Missing");
  console.log("[EMAIL_CONFIG] SMTP_PORT:", port ? "✓ Set" : "✗ Missing");
  console.log("[EMAIL_CONFIG] SMTP_USER:", username ? "✓ Set" : "✗ Missing");
  console.log("[EMAIL_CONFIG] SMTP_PASS:", password ? "✓ Set" : "✗ Missing");
  console.log("[EMAIL_CONFIG] SMTP_FROM:", from ? "✓ Set" : "✗ Using SMTP_USER");

  if (!host || !username || !password) {
    console.error("[EMAIL_CONFIG] ❌ SMTP configuration incomplete");
    return null;
  }

  return {
    host,
    port: port ? parseInt(port) : 587,
    username,
    password,
    from: from || username,
  };
}

async function sendEmail(
  config: EmailConfig,
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<{ success: boolean; error?: string; metadata?: any }> {
  const requestId = crypto.randomUUID();
  console.log(`[EMAIL_SEND:${requestId}] Initializing email to: ${to}`);
  console.log(`[EMAIL_SEND:${requestId}] Subject: ${subject}`);
  console.log(`[EMAIL_SEND:${requestId}] SMTP Host: ${config.host}:${config.port}`);

  try {
    const nodemailer = await import("npm:nodemailer@6.9.7");

    const transporter = nodemailer.default.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      requireTLS: true,
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    console.log(`[EMAIL_SEND:${requestId}] Verifying SMTP connection...`);

    try {
      await transporter.verify();
      console.log(`[EMAIL_SEND:${requestId}] ✅ SMTP connection verified successfully`);
    } catch (verifyError) {
      console.error(`[EMAIL_SEND:${requestId}] ❌ SMTP verification failed:`, verifyError);
      throw new Error(
        `SMTP verification failed: ${verifyError instanceof Error ? verifyError.message : "Unknown error"}`
      );
    }

    console.log(`[EMAIL_SEND:${requestId}] Sending email...`);
    const info = await transporter.sendMail({
      from: `"MFA Buster" <${config.from}>`,
      to: to,
      subject: subject,
      text: textBody,
      html: htmlBody,
    });

    console.log(`[EMAIL_SEND:${requestId}] SMTP Response:`, info.response);
    console.log(`[EMAIL_SEND:${requestId}] Message ID:`, info.messageId);
    console.log(`[EMAIL_SEND:${requestId}] Accepted:`, info.accepted);
    console.log(`[EMAIL_SEND:${requestId}] Rejected:`, info.rejected);

    if (!info.accepted || info.accepted.length === 0) {
      const rejectionReason = info.rejected?.join(", ") || "Unknown reason";
      console.error(`[EMAIL_SEND:${requestId}] ❌ SMTP server rejected the message:`, rejectionReason);
      throw new Error(`SMTP server rejected the message: ${rejectionReason}`);
    }

    console.log(`[EMAIL_SEND:${requestId}] ✅ Email sent and accepted by SMTP server`);

    return {
      success: true,
      metadata: {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      },
    };
  } catch (error) {
    console.error(`[EMAIL_SEND:${requestId}] ❌ Email sending failed`);
    console.error(
      `[EMAIL_SEND:${requestId}] Error:`,
      error instanceof Error ? error.message : String(error)
    );

    let errorMessage = "Unknown email error";
    if (error instanceof Error) {
      if (error.message.includes("EAUTH") || error.message.includes("authentication")) {
        errorMessage = `SMTP Authentication Failed: Invalid credentials for ${config.host}`;
      } else if (error.message.includes("ETIMEDOUT") || error.message.includes("timeout")) {
        errorMessage = `SMTP Timeout: Server ${config.host}:${config.port} not responding`;
      } else if (error.message.includes("ECONNREFUSED")) {
        errorMessage = `SMTP Connection Refused: Cannot connect to ${config.host}:${config.port}`;
      } else if (error.message.includes("ENOTFOUND")) {
        errorMessage = `SMTP Host Not Found: ${config.host} does not exist`;
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : errorMessage,
    };
  }
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`\n${"=".repeat(80)}`);
  console.log(`[REQUEST:${requestId}] New invitation request at ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appUrl = Deno.env.get("APP_URL") || supabaseUrl;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[REQUEST:${requestId}] ❌ Missing Supabase configuration`);
      throw new Error("Missing Supabase configuration");
    }

    console.log(`[REQUEST:${requestId}] Supabase configuration validated`);
    console.log(`[REQUEST:${requestId}] APP_URL:`, appUrl);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const requestBody = await req.json();
    const {
      email,
      name,
      role,
      invited_by,
      company_name,
      partner_id,
      metadata,
      test_mode = false,
    }: SendInvitationRequest = requestBody;

    console.log(`[REQUEST:${requestId}] Processing invitation for: ${email}`);
    console.log(`[REQUEST:${requestId}] Role: ${role}, Invited by: ${invited_by}`);
    console.log(`[REQUEST:${requestId}] Test mode:`, test_mode);

    if (!email || !role || !invited_by) {
      console.error(`[REQUEST:${requestId}] ❌ Missing required fields`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: email, role, invited_by",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error(`[REQUEST:${requestId}] ❌ Invalid email format: ${email}`);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!["super_admin", "admin", "partner"].includes(role)) {
      console.error(`[REQUEST:${requestId}] ❌ Invalid role: ${role}`);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid role specified" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[REQUEST:${requestId}] Checking inviter's permissions...`);
    const { data: inviterUser, error: inviterError } = await supabaseAdmin
      .from("app_users")
      .select("role")
      .eq("id", invited_by)
      .maybeSingle();

    if (inviterError || !inviterUser) {
      console.error(`[REQUEST:${requestId}] ❌ Inviter not found:`, inviterError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Inviter user not found or unauthorized",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if ((role === "admin" || role === "super_admin") && inviterUser.role !== "super_admin") {
      console.error(`[REQUEST:${requestId}] ❌ Insufficient permissions: ${inviterUser.role} cannot create ${role}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Only super admins can create admin or super admin users",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[REQUEST:${requestId}] ✅ Inviter permissions verified: ${inviterUser.role} can create ${role}`);
    console.log(`[REQUEST:${requestId}] Checking for existing user in auth...`);
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers();

    if (checkError) {
      console.error(`[REQUEST:${requestId}] ❌ Error checking users:`, checkError);
    }

    const userExists = existingUsers?.users?.some((u: any) => u.email === email);

    if (userExists) {
      console.log(`[REQUEST:${requestId}] ❌ User already exists: ${email}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "User with this email already exists",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[REQUEST:${requestId}] Checking for pending invitations...`);
    const { data: existingInvite } = await supabaseAdmin
      .from("invitations")
      .select("id, status, expires_at")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
      console.log(`[REQUEST:${requestId}] ❌ Active invitation already exists`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "An active invitation already exists for this email",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[REQUEST:${requestId}] ✅ No existing user or invitation found`);

    const invitationToken = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    console.log(`[REQUEST:${requestId}] Generated invitation token (first 8 chars): ${invitationToken.substring(0, 8)}...`);
    console.log(`[REQUEST:${requestId}] Expires at: ${expiresAt.toISOString()}`);

    console.log(`[REQUEST:${requestId}] Creating invitation record...`);
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("invitations")
      .insert({
        email: email,
        role: role,
        token: invitationToken,
        partner_id: partner_id || null,
        invited_by: invited_by,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        metadata: {
          full_name: name || metadata?.full_name,
          company_name: company_name || metadata?.company_name,
          inviter_name: metadata?.inviter_name,
        },
      })
      .select()
      .single();

    if (invitationError || !invitation) {
      console.error(`[REQUEST:${requestId}] ❌ Failed to create invitation:`, invitationError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to create invitation record",
          details: invitationError?.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[REQUEST:${requestId}] ✅ Invitation record created with ID: ${invitation.id}`);

    const cleanAppUrl = appUrl.replace(/\/+$/, '');
    const acceptInviteUrl = `${cleanAppUrl}/invite/${invitationToken}`;
    console.log(`[REQUEST:${requestId}] Cleaned APP_URL: ${cleanAppUrl}`);
    console.log(`[REQUEST:${requestId}] Invitation URL: ${acceptInviteUrl}`);

    const emailSubject = "You're invited to join LP Media Dashboard";
    const inviterName = metadata?.inviter_name || "Admin";
    const partnerName = name || metadata?.full_name || "there";
    const companyNameDisplay = company_name || metadata?.company_name || "LP Media";

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to LP Media Dashboard</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8fafc;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #48a77f;
      margin-bottom: 10px;
    }
    .title {
      font-size: 24px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 20px;
    }
    .content {
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #48a77f 0%, #3d9166 100%);
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      text-align: center;
      margin: 20px 0;
    }
    .info-box {
      background: #e0f2fe;
      border-left: 4px solid #48a77f;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">LP Media Dashboard</div>
      <div class="title">You're Invited!</div>
    </div>

    <div class="content">
      <p>Hello ${partnerName},</p>

      <p>You've been invited by <strong>${inviterName}</strong> from <strong>${companyNameDisplay}</strong> to join the LP Media Dashboard.</p>

      <p>Your role: <strong>${role.replace("_", " ").toUpperCase()}</strong></p>

      <div style="text-align: center;">
        <a href="${acceptInviteUrl}" class="button">Accept Invitation</a>
      </div>

      <div class="info-box">
        <p><strong>Important:</strong> This invitation link will expire in 7 days. Please click the button above to complete your registration and set your password.</p>
      </div>

      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #48a77f;">${acceptInviteUrl}</p>

      <p>If you have any questions, please contact your administrator.</p>

      <p>Best regards,<br>The LP Media Team</p>
    </div>

    <div class="footer">
      <p>This email was sent to ${email}. If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;

    const emailText = `Hello ${partnerName},

You've been invited by ${inviterName} from ${companyNameDisplay} to join the LP Media Dashboard.

Your role: ${role.replace("_", " ").toUpperCase()}

To accept your invitation and set your password, please visit:
${acceptInviteUrl}

This invitation link will expire in 7 days.

If you have any questions, please contact your administrator.

Best regards,
The LP Media Team

---
This email was sent to ${email}. If you didn't expect this invitation, you can safely ignore this email.`;

    const emailConfig = getEmailConfig();

    let emailStatus = "pending";
    let emailError: string | null = null;
    let emailMetadata: any = {};

    if (test_mode) {
      console.log(`[REQUEST:${requestId}] TEST MODE: Skipping email send`);
      console.log(`[REQUEST:${requestId}] TEST MODE: Invitation URL: ${acceptInviteUrl}`);

      emailStatus = "sent";
      emailMetadata = { test_mode: true, invitation_url: acceptInviteUrl };
    } else if (!emailConfig) {
      console.error(`[REQUEST:${requestId}] ❌ SMTP not configured`);
      emailStatus = "failed";
      emailError = "SMTP configuration missing";
      emailMetadata = { invitation_url: acceptInviteUrl };
    } else {
      console.log(`[REQUEST:${requestId}] Sending invitation email...`);
      const emailResult = await sendEmail(emailConfig, email, emailSubject, emailHtml, emailText);

      if (emailResult.success) {
        emailStatus = "sent";
        emailMetadata = emailResult.metadata || {};
        console.log(`[REQUEST:${requestId}] ✅ Email delivered successfully`);
      } else {
        emailStatus = "failed";
        emailError = emailResult.error || "Unknown email error";
        emailMetadata = { invitation_url: acceptInviteUrl };
        console.error(`[REQUEST:${requestId}] ❌ Email delivery failed: ${emailError}`);
      }
    }

    await supabaseAdmin.from("email_logs").insert({
      email: email,
      subject: emailSubject,
      status: emailStatus,
      error_message: emailError,
      email_type: "invitation",
      metadata: {
        role,
        invited_by,
        invitation_id: invitation.id,
        company_name: companyNameDisplay,
        ...emailMetadata,
      },
    });

    await supabaseAdmin.from("audit_logs").insert({
      user_id: invited_by,
      user_email: email,
      user_role: role,
      action: "user_invitation_sent",
      entity_type: "invitations",
      entity_id: invitation.id,
      details: {
        email,
        role,
        invited_by,
        email_status: emailStatus,
      },
    });

    const duration = Date.now() - startTime;
    console.log(`[REQUEST:${requestId}] Process completed in ${duration}ms`);
    console.log(`${"=".repeat(80)}\n`);

    if (emailStatus === "failed") {
      return new Response(
        JSON.stringify({
          success: false,
          error: emailError || "Email delivery failed",
          details:
            "Invitation created but email could not be delivered. Please check SMTP configuration.",
          invitation_id: invitation.id,
          invitation_url: test_mode ? acceptInviteUrl : undefined,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent successfully to ${email}`,
        invitation_id: invitation.id,
        email_status: emailStatus,
        invitation_url: test_mode ? acceptInviteUrl : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[REQUEST:${requestId}] ❌ Unexpected error after ${duration}ms:`, error);
    console.error(
      `[REQUEST:${requestId}] Error stack:`,
      error instanceof Error ? error.stack : "No stack trace"
    );
    console.log(`${"=".repeat(80)}\n`);

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