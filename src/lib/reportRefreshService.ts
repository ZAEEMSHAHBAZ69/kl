import { supabase } from './supabase';

export interface ReportRefreshResponse {
  success: boolean;
  message?: string;
  error?: string;
  triggeredAt?: string;
  workerResponse?: any;
  durationMs?: number;
}

export class ReportRefreshService {
  private static async getAuthHeaders(): Promise<HeadersInit> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async triggerReportRefresh(): Promise<ReportRefreshResponse> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration');
      }

      const endpoint = `${supabaseUrl}/functions/v1/scheduled-gam-reports-fetch`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          triggered_by: 'manual_refresh',
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to trigger report refresh',
        };
      }

      return {
        success: true,
        message: data.message || 'Report refresh triggered successfully',
        triggeredAt: data.triggeredAt,
        workerResponse: data.workerResponse,
        durationMs: data.durationMs,
      };
    } catch (error) {
      console.error('Report refresh error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
