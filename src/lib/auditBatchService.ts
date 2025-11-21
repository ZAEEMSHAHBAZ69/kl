import { supabase } from './supabase';

export interface SiteNameOption {
  site_name: string;
  count: number;
}

export interface AuditBatch {
  id: string;
  publisher_id: string;
  batch_type: string;
  total_sites: number;
  completed_sites: number;
  failed_sites: number;
  status: string;
  created_at: string;
  completed_at?: string;
  error_details?: Record<string, any>;
}

export interface AuditJob {
  id: string;
  batch_id: string;
  publisher_id: string;
  site_name: string;
  status: string;
  audit_id?: string;
  mfa_score?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

class AuditBatchServiceImpl {
  async fetchPublisherSiteNames(publisherId: string): Promise<SiteNameOption[]> {
    try {
      const { data, error } = await supabase
        .from('reports_dimensional')
        .select('site_name', { count: 'exact' })
        .eq('publisher_id', publisherId)
        .neq('site_name', null);

      if (error) throw error;

      const siteNameMap = new Map<string, number>();
      if (data) {
        data.forEach((row: any) => {
          if (row.site_name) {
            siteNameMap.set(row.site_name, (siteNameMap.get(row.site_name) || 0) + 1);
          }
        });
      }

      return Array.from(siteNameMap.entries())
        .map(([site_name, count]) => ({ site_name, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('Error fetching publisher site names:', error);
      return [];
    }
  }


  async getBatchProgress(batchId: string): Promise<AuditBatch | null> {
    try {
      const { data, error } = await supabase
        .from('audit_batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching batch progress:', error);
      return null;
    }
  }

  async getBatchJobs(batchId: string): Promise<AuditJob[]> {
    try {
      const { data, error } = await supabase
        .from('audit_jobs')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching batch jobs:', error);
      return [];
    }
  }

  async subscribeToBatchUpdates(
    batchId: string,
    callback: (batch: AuditBatch | null) => void
  ): Promise<() => void> {
    const channel = supabase
      .channel(`audit_batch_${batchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_batches',
          filter: `id=eq.${batchId}`,
        },
        (payload) => {
          callback(payload.new as AuditBatch | null);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  async subscribeToJobUpdates(
    batchId: string,
    callback: (job: AuditJob) => void
  ): Promise<() => void> {
    const channel = supabase
      .channel(`audit_jobs_${batchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_jobs',
          filter: `batch_id=eq.${batchId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as AuditJob);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  async initiateMultiSiteAudit(
    publisherId: string,
    siteNames: string[],
    token: string
  ): Promise<{ success: boolean; batchId?: string; error?: string }> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/audit-batch-sites`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Client-Info': 'audit-batch-client/1.0',
            'Apikey': anonKey,
          },
          body: JSON.stringify({
            publisher_id: publisherId,
            site_names: siteNames,
          }),
        }
      );

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error initiating multi-site audit:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const auditBatchService = new AuditBatchServiceImpl();
