import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export class SupabaseIntegration {
  private client = supabaseClient;
  private admin = supabaseAdmin;

  async query(table: string, filters?: Record<string, any>) {
    let query = this.client.from(table).select('*');

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value) as any;
      });
    }

    return query;
  }

  async insert(table: string, data: any) {
    return this.client.from(table).insert(data).select();
  }

  async update(table: string, id: string, data: any) {
    return this.client.from(table).update(data).eq('id', id).select();
  }

  async delete(table: string, id: string) {
    return this.client.from(table).delete().eq('id', id);
  }

  async getReportHistorical(publisherId: string) {
    return this.client
      .from('report_historical')
      .select('*')
      .eq('publisher_id', publisherId);
  }

  async getReportDimensional(publisherId: string, dateRange?: { start: string; end: string }) {
    let query = this.client
      .from('reports_dimensional')
      .select('*')
      .eq('publisher_id', publisherId);

    if (dateRange) {
      query = query
        .gte('date', dateRange.start)
        .lte('date', dateRange.end) as any;
    }

    return query;
  }

  async batchInsert(table: string, data: any[]) {
    return this.client.from(table).insert(data);
  }

  async callFunction(functionName: string, payload: any) {
    return this.client.functions.invoke(functionName, {
      body: payload,
    });
  }
}

export const supabaseIntegration = new SupabaseIntegration();
