export interface EnvConfig {
  supabase: {
    url: string;
    anonKey: string;
    serviceKey?: string;
  };
  openRouter: {
    apiKey: string;
    model: string;
  };
  worker: {
    endpoint: string;
  };
  scheduler: {
    endpoint: string;
  };
  logLevel: string;
  nodeEnv: string;
}

function getEnvConfig(): EnvConfig {
  return {
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL || '',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      serviceKey: import.meta.env.VITE_SUPABASE_SERVICE_KEY,
    },
    openRouter: {
      apiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
      model: import.meta.env.VITE_OPENROUTER_MODEL || 'nvidia/nemotron-nano-12b-vision',
    },
    worker: {
      endpoint: import.meta.env.VITE_WORKER_ENDPOINT || 'http://localhost:3000',
    },
    scheduler: {
      endpoint: import.meta.env.VITE_SCHEDULER_ENDPOINT || 'http://localhost:3001',
    },
    logLevel: import.meta.env.VITE_LOG_LEVEL || 'INFO',
    nodeEnv: import.meta.env.NODE_ENV || 'development',
  };
}

export const envConfig = getEnvConfig();

export function validateConfig(): string[] {
  const errors: string[] = [];

  if (!envConfig.supabase.url) errors.push('VITE_SUPABASE_URL is required');
  if (!envConfig.supabase.anonKey) errors.push('VITE_SUPABASE_ANON_KEY is required');
  if (!envConfig.openRouter.apiKey) errors.push('VITE_OPENROUTER_API_KEY is required');

  return errors;
}
