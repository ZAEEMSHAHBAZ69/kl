import { supabase } from './supabase';

export interface PublisherAuditResult {
  publisherId: string;
  publisherName: string;
  status: 'queued' | 'failed';
  error?: string;
}

export interface TriggerAllAuditsResponse {
  success: boolean;
  totalPublishers: number;
  queuedPublishers: number;
  failedPublishers: number;
  results: PublisherAuditResult[];
}

class TriggerAllAuditsService {
  async triggerAllPublisherAudits(): Promise<TriggerAllAuditsResponse> {
    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session?.session?.access_token) {
        throw new Error('Authentication required');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/trigger-all-publisher-audits`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'trigger_all',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to trigger audits: ${error}`);
      }

      const data: TriggerAllAuditsResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Error triggering all audits:', error);
      throw error;
    }
  }
}

export const triggerAllAuditsService = new TriggerAllAuditsService();
