export interface WorkerCallOptions {
  workerUrl: string;
  endpoint: string;
  requestId: string;
  body?: Record<string, unknown>;
  method?: 'GET' | 'POST';
  maxRetries?: number;
  initialTimeout?: number;
  retryDelays?: number[];
  workerSecret?: string;
  enableCircuitBreaker?: boolean;
}

const circuitBreakerState: {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
} = {
  failures: 0,
  lastFailureTime: 0,
  isOpen: false,
};

export interface WorkerCallResult {
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

function checkCircuitBreaker(enableBreaker: boolean): boolean {
  if (!enableBreaker) return true;

  const now = Date.now();
  const resetTimeout = 60000;

  if (circuitBreakerState.isOpen) {
    if (now - circuitBreakerState.lastFailureTime > resetTimeout) {
      circuitBreakerState.isOpen = false;
      circuitBreakerState.failures = 0;
      return true;
    }
    return false;
  }

  return true;
}

function recordFailure(enableBreaker: boolean): void {
  if (!enableBreaker) return;

  circuitBreakerState.failures++;
  circuitBreakerState.lastFailureTime = Date.now();

  if (circuitBreakerState.failures >= 5) {
    circuitBreakerState.isOpen = true;
  }
}

function recordSuccess(enableBreaker: boolean): void {
  if (!enableBreaker) return;

  circuitBreakerState.failures = 0;
  circuitBreakerState.isOpen = false;
}

export async function callWorkerWithResilience(
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
    enableCircuitBreaker = true,
  } = options;

  if (!checkCircuitBreaker(enableCircuitBreaker)) {
    console.warn(`[${requestId}] Circuit breaker is open, failing fast`);
    return {
      success: false,
      error: 'Circuit breaker is open - worker appears to be down',
      attempts: 0,
      coldStart: false,
      totalDuration: 0,
    };
  }

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

      recordSuccess(enableCircuitBreaker);
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

  recordFailure(enableCircuitBreaker);
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

export async function logColdStart(
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