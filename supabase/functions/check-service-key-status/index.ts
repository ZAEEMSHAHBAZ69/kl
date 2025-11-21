import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

interface JWTHeader {
  alg: string;
  typ: string;
}

interface JWTPayload {
  iss: string;
  scope: string;
  aud: string;
  exp: number;
  iat: number;
}

async function base64UrlEncode(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pemKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

async function signJWT(header: string, payload: string, privateKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${header}.${payload}`);

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    data
  );

  const signatureArray = new Uint8Array(signature);
  const base64Signature = btoa(String.fromCharCode(...signatureArray));
  return base64Signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createServiceAccountJWT(
  credentials: ServiceAccountCredentials,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header: JWTHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload: JWTPayload = {
    iss: credentials.client_email,
    scope: scopes.join(' '),
    aud: credentials.token_uri,
    exp: expiry,
    iat: now,
  };

  const encodedHeader = await base64UrlEncode(JSON.stringify(header));
  const encodedPayload = await base64UrlEncode(JSON.stringify(payload));

  const privateKey = await importPrivateKey(credentials.private_key);
  const signature = await signJWT(encodedHeader, encodedPayload, privateKey);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const scopes = [
    'https://www.googleapis.com/auth/dfp',
  ];

  const jwt = await createServiceAccountJWT(credentials, scopes);

  const tokenResponse = await fetch(credentials.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  try {
    const serviceAccountJson = Deno.env.get('GAM_SERVICE_ACCOUNT_JSON');

    if (!serviceAccountJson) {
      console.error('GAM_SERVICE_ACCOUNT_JSON environment variable not set');
      return null;
    }

    const credentials = JSON.parse(serviceAccountJson);

    if (!credentials.private_key || !credentials.client_email || !credentials.token_uri) {
      console.error('Service account credentials missing required fields');
      return null;
    }

    return credentials;
  } catch (error) {
    console.error('Error parsing service account credentials:', error);
    return null;
  }
}

async function checkNetworkAccess(networkCode: string, accessToken: string): Promise<{
  status: 'active' | 'invalid' | 'no_service_email';
  error?: string;
}> {
  try {
    const gamApiUrl = `https://admanager.googleapis.com/v1/networks/${networkCode}`;

    console.log(`Checking network access for network code: ${networkCode}`);

    const response = await fetch(gamApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const networkData = await response.json();
      console.log('Successfully accessed GAM network:', networkData.displayName || networkCode);
      return { status: 'active' };
    }

    const errorData = await response.json();
    console.error('GAM API error:', response.status, errorData);

    let errorMessage = 'Access denied or network not found';
    let status: 'invalid' | 'no_service_email' = 'invalid';

    if (response.status === 403) {
      errorMessage = 'No service account email configured in GAM';
      status = 'no_service_email';
    } else if (response.status === 404) {
      errorMessage = 'Network not found';
    } else if (response.status === 401) {
      errorMessage = 'Authentication failed';
    }

    return {
      status,
      error: errorMessage,
    };
  } catch (error) {
    console.error('Network check error:', error);
    return {
      status: 'invalid',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const publisherId = url.searchParams.get('publisherId');

    if (publisherId) {
      const { data: publisher, error: fetchError } = await supabase
        .from('publishers')
        .select('id, name, domain, network_code')
        .eq('id', publisherId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch publisher: ${fetchError.message}`);
      }

      if (!publisher.network_code) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Publisher does not have a network code',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const credentials = getServiceAccountCredentials();
      if (!credentials) {
        throw new Error('Service account credentials not configured');
      }

      const accessToken = await getAccessToken(credentials);
      const result = await checkNetworkAccess(publisher.network_code, accessToken);

      const { error: updateError } = await supabase
        .from('publishers')
        .update({
          service_key_status: result.status,
          service_key_error: result.error || null,
          service_key_last_check: new Date().toISOString(),
        })
        .eq('id', publisherId);

      if (updateError) {
        throw new Error(`Failed to update publisher: ${updateError.message}`);
      }

      if (result.status === 'no_service_email' || result.status === 'invalid') {
        const alertType = result.status === 'no_service_email' ? 'no_service_email' : 'gam_access_failed';
        const alertTitle = result.status === 'no_service_email'
          ? 'No Service Email Configured'
          : 'GAM Access Failed';
        const alertMessage = result.status === 'no_service_email'
          ? `Publisher "${publisher.name}" (${publisher.domain}) - Network Code: ${publisher.network_code} does not have a service account email configured in Google Ad Manager.`
          : `Unable to access GAM network for publisher "${publisher.name}" (${publisher.domain}) - Network Code: ${publisher.network_code}. Error: ${result.error}`;

        const { data: alert, error: alertError } = await supabase
          .from('alerts')
          .insert({
            publisher_id: publisherId,
            type: alertType,
            severity: 'high',
            status: 'pending',
            title: alertTitle,
            message: alertMessage,
            details: {
              network_code: publisher.network_code,
              service_key_status: result.status,
              error: result.error,
              checked_at: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (alertError) {
          console.error('Failed to create alert:', alertError);
        } else {
          const { data: admins, error: adminsError } = await supabase
            .from('app_users')
            .select('email')
            .in('role', ['admin', 'super_admin'])
            .eq('status', 'active');

          if (!adminsError && admins && admins.length > 0) {
            for (const admin of admins) {
              try {
                await fetch(`${supabaseUrl}/functions/v1/send-alert-email`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    testEmail: admin.email,
                    type: alertType,
                    severity: 'high',
                    message: alertMessage,
                    publisherId: publisherId,
                    networkCode: publisher.network_code,
                    serviceKeyStatus: result.status,
                  }),
                });
              } catch (emailError) {
                console.error(`Failed to send email to ${admin.email}:`, emailError);
              }
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          publisherId,
          status: result.status,
          error: result.error,
          checkedAt: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: publishers, error: fetchError } = await supabase
      .from('publishers')
      .select('id, name, domain, network_code')
      .not('network_code', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch publishers: ${fetchError.message}`);
    }

    const credentials = getServiceAccountCredentials();
    if (!credentials) {
      throw new Error('Service account credentials not configured');
    }

    const accessToken = await getAccessToken(credentials);
    const results = [];

    for (const publisher of publishers) {
      const result = await checkNetworkAccess(publisher.network_code, accessToken);

      const { error: updateError } = await supabase
        .from('publishers')
        .update({
          service_key_status: result.status,
          service_key_error: result.error || null,
          service_key_last_check: new Date().toISOString(),
        })
        .eq('id', publisher.id);

      if (result.status === 'no_service_email' || result.status === 'invalid') {
        const alertType = result.status === 'no_service_email' ? 'no_service_email' : 'gam_access_failed';
        const alertTitle = result.status === 'no_service_email'
          ? 'No Service Email Configured'
          : 'GAM Access Failed';
        const alertMessage = result.status === 'no_service_email'
          ? `Publisher "${publisher.name}" (${publisher.domain}) - Network Code: ${publisher.network_code} does not have a service account email configured in Google Ad Manager.`
          : `Unable to access GAM network for publisher "${publisher.name}" (${publisher.domain}) - Network Code: ${publisher.network_code}. Error: ${result.error}`;

        const { data: alert, error: alertError } = await supabase
          .from('alerts')
          .insert({
            publisher_id: publisher.id,
            type: alertType,
            severity: 'high',
            status: 'pending',
            title: alertTitle,
            message: alertMessage,
            details: {
              network_code: publisher.network_code,
              service_key_status: result.status,
              error: result.error,
              checked_at: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (alertError) {
          console.error('Failed to create alert:', alertError);
        } else {
          const { data: admins, error: adminsError } = await supabase
            .from('app_users')
            .select('email')
            .in('role', ['admin', 'super_admin'])
            .eq('status', 'active');

          if (!adminsError && admins && admins.length > 0) {
            for (const admin of admins) {
              try {
                await fetch(`${supabaseUrl}/functions/v1/send-alert-email`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    testEmail: admin.email,
                    type: alertType,
                    severity: 'high',
                    message: alertMessage,
                    publisherId: publisher.id,
                    networkCode: publisher.network_code,
                    serviceKeyStatus: result.status,
                  }),
                });
              } catch (emailError) {
                console.error(`Failed to send email to ${admin.email}:`, emailError);
              }
            }
          }
        }
      }

      results.push({
        publisherId: publisher.id,
        networkCode: publisher.network_code,
        status: result.status,
        error: result.error,
        updateError: updateError?.message,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: results.length,
        results,
        checkedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error checking service key status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
