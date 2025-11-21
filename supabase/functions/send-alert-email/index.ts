import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};

function getEmailConfig() {
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

  if (!host || !username || !password) {
    console.error("[EMAIL_CONFIG] ❌ SMTP configuration incomplete");
    return null;
  }

  return {
    host,
    port: port ? parseInt(port) : 587,
    username,
    password,
    from: from || username
  };
}

async function sendEmail(config: any, to: string, subject: string, htmlBody: string) {
  const requestId = crypto.randomUUID();
  console.log(`[EMAIL_SEND:${requestId}] Sending alert email to: ${to}`);

  try {
    const nodemailer = await import("npm:nodemailer@6.9.7");
    const transporter = nodemailer.default.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      requireTLS: true,
      auth: {
        user: config.username,
        pass: config.password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    console.log(`[EMAIL_SEND:${requestId}] Verifying SMTP connection...`);
    await transporter.verify();
    console.log(`[EMAIL_SEND:${requestId}] ✅ SMTP verified`);

    const info = await transporter.sendMail({
      from: `"MFA Buster Alerts" <${config.from}>`,
      to: to,
      subject: subject,
      html: htmlBody
    });

    console.log(`[EMAIL_SEND:${requestId}] ✅ Email sent successfully`);
    console.log(`[EMAIL_SEND:${requestId}] Message ID:`, info.messageId);

    return {
      success: true,
      metadata: {
        messageId: info.messageId,
        response: info.response
      }
    };
  } catch (error) {
    console.error(`[EMAIL_SEND:${requestId}] ❌ Failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestData = req.method === 'POST' ? await req.json() : {};

    let alertData: any;
    let recipientEmails: string[] = [];

    // Handle direct alert data (from site-monitoring-worker)
    if (requestData.alertId && requestData.publisherName) {
      // Direct call from site-monitoring-worker with all data provided
      alertData = {
        id: requestData.alertId,
        alert_type: requestData.alertType,
        severity: requestData.severity,
        message: requestData.message,
        metadata: requestData.metadata || {},
        created_at: requestData.timestamp,
        publisher_id: requestData.publisherId,
        publishers: {
          name: requestData.publisherName,
          primary_domain: requestData.publisherDomain
        }
      };

      // Use provided recipient or fetch admins
      if (requestData.recipientEmail) {
        recipientEmails = [requestData.recipientEmail];
      } else {
        const { data: adminUsers, error: adminError } = await supabase
          .from('app_users')
          .select('email')
          .in('role', ['admin', 'super_admin']);

        if (adminError) throw new Error(`Failed to fetch admin users: ${adminError.message}`);
        if (!adminUsers || adminUsers.length === 0) {
          throw new Error('No admin or super admin users found');
        }

        recipientEmails = adminUsers.map(u => u.email).filter(email => email);
      }
    }
    // Handle test email
    else if (requestData.testEmail) {
      alertData = {
        id: 'test-alert-' + Date.now(),
        alert_type: requestData.type || 'service_key_failure',
        severity: requestData.severity || 'high',
        message: requestData.message || 'This is a test alert email from the monitoring system.',
        publisher_id: requestData.publisherId || 'test-publisher',
        created_at: new Date().toISOString()
      };
      recipientEmails = [requestData.testEmail];
    }
    // Handle lookup by alertId - determine which table based on source
    else if (requestData.alertId) {
      // Check if this is from site-monitoring-worker (publisher_trend_alerts)
      // or gam-report-worker (alerts)
      const usePublisherTrendAlerts = requestData.source === 'site-monitoring' || requestData.useTrendAlerts;

      if (usePublisherTrendAlerts) {
        // Site-monitoring-worker: Use publisher_trend_alerts table
        const { data: alert, error: alertError } = await supabase
          .from('publisher_trend_alerts')
          .select(`
            *,
            publishers (
              name,
              primary_domain
            )
          `)
          .eq('id', requestData.alertId)
          .single();

        if (alertError) {
          throw new Error(`Failed to fetch alert from publisher_trend_alerts: ${alertError.message}`);
        }

        alertData = alert;
      } else {
        // GAM-report-worker: Use alerts table
        const { data: alert, error: alertError } = await supabase
          .from('alerts')
          .select(`
            *,
            publishers (
              name,
              domain
            )
          `)
          .eq('id', requestData.alertId)
          .single();

        if (alertError) {
          throw new Error(`Failed to fetch alert from alerts table: ${alertError.message}`);
        }

        alertData = alert;
      }

      const { data: adminUsers, error: adminError } = await supabase
        .from('app_users')
        .select('email')
        .in('role', ['admin', 'super_admin']);

      if (adminError) {
        throw new Error(`Failed to fetch admin users: ${adminError.message}`);
      }

      if (!adminUsers || adminUsers.length === 0) {
        throw new Error('No admin or super admin users found to send alerts to');
      }

      recipientEmails = adminUsers.map(u => u.email).filter(email => email);

      if (recipientEmails.length === 0) {
        throw new Error('No valid admin email addresses found');
      }
    } else {
      throw new Error('Either alertId with data or testEmail must be provided');
    }

    const emailBody = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #48a77f; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
            .alert-info { margin: 20px 0; padding: 15px; background-color: white; border-left: 4px solid #48a77f; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .severity {
              display: inline-block;
              padding: 5px 10px;
              border-radius: 3px;
              font-weight: bold;
            }
            .severity-critical { background-color: #dc3545; color: white; }
            .severity-high { background-color: #fd7e14; color: white; }
            .severity-medium { background-color: #ffc107; color: black; }
            .severity-low { background-color: #28a745; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Site Monitoring Alert</h1>
            </div>
            <div class="content">
              <div class="alert-info">
                <p><strong>Alert ID:</strong> ${alertData.id}</p>
                <p><strong>Type:</strong> ${(alertData.alert_type || alertData.type || '').replace(/_/g, ' ').toUpperCase()}</p>
                <p>
                  <strong>Severity:</strong>
                  <span class="severity severity-${alertData.severity}">${alertData.severity.toUpperCase()}</span>
                </p>
                <p><strong>Time:</strong> ${new Date(alertData.created_at).toLocaleString()}</p>
              </div>
              <h3>Message:</h3>
              <p>${alertData.message}</p>
              ${alertData.publishers ? `
                <h3>Publisher Details:</h3>
                <p><strong>Name:</strong> ${alertData.publishers.name}</p>
                <p><strong>Domain:</strong> ${alertData.publishers.primary_domain || alertData.publishers.domain || 'N/A'}</p>
              ` : ''}
              ${alertData.metadata && Object.keys(alertData.metadata).length > 0 ? `
                <h3>Additional Details:</h3>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(alertData.metadata, null, 2)}</pre>
              ` : ''}
              <p style="margin-top: 20px;">
                Please log in to the dashboard to acknowledge or resolve this alert.
              </p>
            </div>
            <div class="footer">
              <p>This is an automated alert from your MFA Buster monitoring system.</p>
              <p>Do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log(`Sending alert emails to ${recipientEmails.length} admin(s): ${recipientEmails.join(', ')}`);
    console.log(`Alert details:`, {
      id: alertData.id,
      type: alertData.alert_type || alertData.type,
      severity: alertData.severity
    });

    const emailSubject = `[${alertData.severity.toUpperCase()}] Alert: ${(alertData.alert_type || alertData.type || '').replace(/_/g, ' ')}`;
    const emailConfig = getEmailConfig();
    const emailResults: any[] = [];

    if (!emailConfig) {
      console.error('❌ SMTP not configured, cannot send emails');
      for (const email of recipientEmails) {
        emailResults.push({
          email,
          status: 'failed',
          error: 'SMTP configuration missing',
          metadata: {}
        });
      }
    } else {
      console.log('Attempting to send emails via SMTP...');
      for (const email of recipientEmails) {
        const emailResult = await sendEmail(emailConfig, email, emailSubject, emailBody);

        if (emailResult.success) {
          emailResults.push({
            email,
            status: 'sent',
            error: null,
            metadata: emailResult.metadata || {}
          });
          console.log(`✅ Email sent successfully to ${email}`);
        } else {
          emailResults.push({
            email,
            status: 'failed',
            error: emailResult.error || 'Unknown email error',
            metadata: {}
          });
          console.error(`❌ Email delivery failed to ${email}:`, emailResult.error);
        }
      }
    }

    // Log email attempts
    for (const result of emailResults) {
      const { error: emailLogError } = await supabase.from('email_logs').insert({
        email: result.email,
        subject: emailSubject,
        status: result.status,
        error_message: result.error,
        email_type: 'alert',
        metadata: {
          alert_id: alertData.id,
          alert_type: alertData.alert_type || alertData.type,
          severity: alertData.severity,
          publisher_id: alertData.publisher_id || requestData.publisherId,
          ...result.metadata
        },
        recipient: result.email,
        body: emailBody,
        alert_id: alertData.id
      });

      if (emailLogError) {
        console.error(`Failed to log email for ${result.email}:`, emailLogError);
      }
    }

    const successCount = emailResults.filter(r => r.status === 'sent').length;
    const failedCount = emailResults.filter(r => r.status === 'failed').length;

    if (successCount === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'All email deliveries failed',
        details: 'Alert created but emails could not be delivered. Please check SMTP configuration.',
        alertId: alertData.id,
        recipients: recipientEmails,
        results: emailResults
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Alert emails sent: ${successCount} succeeded, ${failedCount} failed`,
      alertId: alertData.id,
      recipients: recipientEmails,
      successCount,
      failedCount,
      results: emailResults,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error sending alert email:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});