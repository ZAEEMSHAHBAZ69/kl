import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const requestId = crypto.randomUUID();
  console.log(`[REQUEST:${requestId}] New GAM API request at ${new Date().toISOString()}`);

  try {
    const credentials = getServiceAccountCredentials();

    if (!credentials) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Service account credentials not configured',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[REQUEST:${requestId}] Getting access token...`);
    const accessToken = await getAccessToken(credentials);
    console.log(`[REQUEST:${requestId}] Access token obtained successfully`);

    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') || 'test';
    const networkCode = url.searchParams.get('networkCode');

    if (endpoint === 'test') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Google Ad Manager API authentication successful',
          service_account: credentials.client_email,
          token_obtained: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (endpoint === 'list-networks') {
      console.log(`[REQUEST:${requestId}] Listing all accessible networks...`);
      const listNetworksUrl = 'https://admanager.googleapis.com/v1/networks';

      const listResponse = await fetch(listNetworksUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const listData = await listResponse.json();

      return new Response(
        JSON.stringify({
          success: listResponse.ok,
          data: listData,
          status: listResponse.status,
        }),
        {
          status: listResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!networkCode) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'networkCode parameter is required for API calls',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let gamApiUrl = '';
    let method = 'GET';
    let body = null;

    switch (endpoint) {
      case 'network':
        gamApiUrl = `https://admanager.googleapis.com/v1/networks/${networkCode}`;
        console.log(`[REQUEST:${requestId}] Attempting to access network with code: ${networkCode}`);
        break;
      case 'orders':
        gamApiUrl = `https://admanager.googleapis.com/v1/networks/${networkCode}/orders?pageSize=1`;
        break;
      case 'line-items':
        const orderId = url.searchParams.get('orderId');
        if (!orderId) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'orderId parameter is required for line-items endpoint',
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        gamApiUrl = `https://admanager.googleapis.com/v1/networks/${networkCode}/orders/${orderId}/lineItems`;
        break;
      case 'custom':
        const customPath = url.searchParams.get('path');
        if (!customPath) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'path parameter is required for custom endpoint',
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        gamApiUrl = customPath;
        break;
      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid endpoint specified',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }

    console.log(`[REQUEST:${requestId}] Calling GAM API: ${gamApiUrl}`);

    const gamResponse = await fetch(gamApiUrl, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseData = await gamResponse.json();

    if (!gamResponse.ok) {
      console.error(`[REQUEST:${requestId}] GAM API error:`, responseData);

      let errorMessage = 'GAM API request failed';
      if (gamResponse.status === 403) {
        errorMessage = `Access denied. The service account (${credentials.client_email}) does not have permission to access this GAM network. Please add it as an Admin or Reports user in GAM Admin → Access & Authorization → Users.`;
      } else if (gamResponse.status === 404) {
        errorMessage = 'Network not found. Please verify the network code is correct.';
      } else if (gamResponse.status === 401) {
        errorMessage = 'Authentication failed. Please verify the service account credentials are correct.';
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          details: responseData,
          status: gamResponse.status,
          networkCode: networkCode,
          serviceAccount: credentials.client_email,
        }),
        {
          status: gamResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[REQUEST:${requestId}] GAM API request successful`);

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error(`[REQUEST:${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});