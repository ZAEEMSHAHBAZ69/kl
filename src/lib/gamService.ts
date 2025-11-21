import { supabase } from './supabase';

export interface GAMApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export class GAMService {
  private static async getAuthHeaders(): Promise<HeadersInit> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private static async callEdgeFunction(
    _endpoint: string,
    params: Record<string, string> = {}
  ): Promise<GAMApiResponse> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const queryParams = new URLSearchParams(params);
      const url = `${supabaseUrl}/functions/v1/gam-api?${queryParams}`;

      const headers = await this.getAuthHeaders();

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('GAM API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async testConnection(): Promise<GAMApiResponse> {
    return this.callEdgeFunction('gam-api', { endpoint: 'test' });
  }

  static async getNetwork(networkCode: string): Promise<GAMApiResponse> {
    return this.callEdgeFunction('gam-api', {
      endpoint: 'network',
      networkCode,
    });
  }

  static async getOrders(networkCode: string): Promise<GAMApiResponse> {
    return this.callEdgeFunction('gam-api', {
      endpoint: 'orders',
      networkCode,
    });
  }

  static async getLineItems(
    networkCode: string,
    orderId: string
  ): Promise<GAMApiResponse> {
    return this.callEdgeFunction('gam-api', {
      endpoint: 'line-items',
      networkCode,
      orderId,
    });
  }

  static async customRequest(
    path: string,
    networkCode?: string
  ): Promise<GAMApiResponse> {
    const params: Record<string, string> = {
      endpoint: 'custom',
      path,
    };

    if (networkCode) {
      params.networkCode = networkCode;
    }

    return this.callEdgeFunction('gam-api', params);
  }

  static async listAccessibleNetworks(): Promise<GAMApiResponse> {
    return this.callEdgeFunction('gam-api', { endpoint: 'list-networks' });
  }

  static async verifyServiceAccountAccess(
    networkCode: string
  ): Promise<{ status: 'active' | 'invalid'; error?: string; details?: any }> {
    try {
      const response = await this.getNetwork(networkCode);

      if (response.success && response.data) {
        return { status: 'active' };
      } else {
        // If network verification fails, try listing all networks to see what we have access to
        const networksResponse = await this.listAccessibleNetworks();

        return {
          status: 'invalid',
          error: response.error || 'Unauthorized or missing GAM access',
          details: {
            apiResponse: response,
            accessibleNetworks: networksResponse.success ? networksResponse.data : null,
            networkCode: networkCode,
          },
        };
      }
    } catch (error) {
      return {
        status: 'invalid',
        error: error instanceof Error ? error.message : 'Failed to verify GAM access',
      };
    }
  }
}
