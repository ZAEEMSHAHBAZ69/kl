import { supabase } from './supabase';

export interface AuditDataStats {
  siteAuditsCount: number;
  auditResultsCount: number;
  auditFailuresCount: number;
  operationLogsCount: number;
  lastAuditTimestamp?: string;
  lastFailureTimestamp?: string;
  lastLogTimestamp?: string;
  successRate: number;
}

export interface DatabaseHealthReport {
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  stats: AuditDataStats;
  recentErrors: Array<{
    table: string;
    operation: string;
    errorMessage: string;
    timestamp: string;
  }>;
  slowQueries: Array<{
    operation: string;
    table: string;
    duration_ms: number;
    timestamp: string;
  }>;
}

class AuditDataVerification {
  async getAuditDataStats(): Promise<AuditDataStats> {
    try {
      const [siteAuditsResult, auditResultsResult, auditFailuresResult, operationLogsResult] =
        await Promise.all([
          supabase.from('site_audits').select('count', { count: 'exact', head: true }),
          supabase.from('audit_results').select('count', { count: 'exact', head: true }),
          supabase.from('audit_failures').select('count', { count: 'exact', head: true }),
          supabase.from('db_operation_logs').select('count', { count: 'exact', head: true }),
        ]);

      const siteAuditsCount = siteAuditsResult.count || 0;
      const auditResultsCount = auditResultsResult.count || 0;
      const auditFailuresCount = auditFailuresResult.count || 0;
      const operationLogsCount = operationLogsResult.count || 0;

      const lastAuditResult = await supabase
        .from('site_audits')
        .select('completed_at')
        .order('completed_at', { ascending: false })
        .limit(1);

      const lastFailureResult = await supabase
        .from('audit_failures')
        .select('failure_timestamp')
        .order('failure_timestamp', { ascending: false })
        .limit(1);

      const lastLogResult = await supabase
        .from('db_operation_logs')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(1);

      const totalAttempts = siteAuditsCount + auditFailuresCount;
      const successRate = totalAttempts > 0 ? (siteAuditsCount / totalAttempts) * 100 : 0;

      return {
        siteAuditsCount,
        auditResultsCount,
        auditFailuresCount,
        operationLogsCount,
        lastAuditTimestamp: lastAuditResult.data?.[0]?.completed_at,
        lastFailureTimestamp: lastFailureResult.data?.[0]?.failure_timestamp,
        lastLogTimestamp: lastLogResult.data?.[0]?.timestamp,
        successRate: Math.round(successRate * 100) / 100,
      };
    } catch (error) {
      console.error('Error fetching audit data stats:', error);
      throw error;
    }
  }

  async getRecentErrors(limit: number = 10): Promise<
    Array<{
      table: string;
      operation: string;
      errorMessage: string;
      timestamp: string;
    }>
  > {
    try {
      const { data, error } = await supabase
        .from('db_operation_logs')
        .select('table_name, operation, error_message, timestamp')
        .eq('status', 'failure')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (
        data?.map((log) => ({
          table: log.table_name || 'unknown',
          operation: log.operation,
          errorMessage: log.error_message || 'Unknown error',
          timestamp: log.timestamp,
        })) || []
      );
    } catch (error) {
      console.error('Error fetching recent errors:', error);
      return [];
    }
  }

  async getSlowQueries(thresholdMs: number = 5000, limit: number = 10): Promise<
    Array<{
      operation: string;
      table: string;
      duration_ms: number;
      timestamp: string;
    }>
  > {
    try {
      const { data, error } = await supabase
        .from('db_operation_logs')
        .select('operation, table_name, duration_ms, timestamp')
        .gt('duration_ms', thresholdMs)
        .order('duration_ms', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (
        data?.map((log) => ({
          operation: log.operation,
          table: log.table_name || 'unknown',
          duration_ms: log.duration_ms || 0,
          timestamp: log.timestamp,
        })) || []
      );
    } catch (error) {
      console.error('Error fetching slow queries:', error);
      return [];
    }
  }

  async generateHealthReport(): Promise<DatabaseHealthReport> {
    try {
      const stats = await this.getAuditDataStats();
      const recentErrors = await this.getRecentErrors(5);
      const slowQueries = await this.getSlowQueries(5000, 5);

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (recentErrors.length > 0 && stats.successRate < 80) {
        status = 'warning';
      }

      if (stats.successRate < 50 || recentErrors.length > 10) {
        status = 'critical';
      }

      return {
        timestamp: new Date().toISOString(),
        status,
        stats,
        recentErrors,
        slowQueries,
      };
    } catch (error) {
      console.error('Error generating health report:', error);
      throw error;
    }
  }

  async verifyDataPersistence(
    table: string,
    recordId: string
  ): Promise<{
    exists: boolean;
    record?: any;
    verificationTime: number;
  }> {
    const startTime = Date.now();

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', recordId)
        .single();

      const verificationTime = Date.now() - startTime;

      if (error) {
        return {
          exists: false,
          verificationTime,
        };
      }

      return {
        exists: !!data,
        record: data,
        verificationTime,
      };
    } catch (error) {
      const verificationTime = Date.now() - startTime;
      console.error(`Error verifying data in ${table}:`, error);
      return {
        exists: false,
        verificationTime,
      };
    }
  }

  async getOperationLogsByStatus(status: 'success' | 'failure', limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('db_operation_logs')
        .select(
          'id, timestamp, level, operation, table_name, status, message, duration_ms, record_count, error_message'
        )
        .eq('status', status)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error(`Error fetching operation logs with status ${status}:`, error);
      return [];
    }
  }

  async getOperationLogsByTable(table: string, limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('db_operation_logs')
        .select(
          'id, timestamp, level, operation, table_name, status, message, duration_ms, record_count, error_message'
        )
        .eq('table_name', table)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error(`Error fetching operation logs for table ${table}:`, error);
      return [];
    }
  }

  async getAuditSummaryByPublisher(publisherId: string) {
    try {
      const [siteAuditsResult, auditResultsResult, auditFailuresResult] = await Promise.all([
        supabase
          .from('site_audits')
          .select('*')
          .eq('publisher_id', publisherId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('audit_results')
          .select('id, audit_type, risk_score, audit_timestamp')
          .eq('publisher_id', publisherId)
          .order('audit_timestamp', { ascending: false })
          .limit(10),
        supabase
          .from('audit_failures')
          .select('id, module, error_message, failure_timestamp')
          .eq('publisher_id', publisherId)
          .order('failure_timestamp', { ascending: false })
          .limit(10),
      ]);

      return {
        siteAudits: siteAuditsResult.data || [],
        auditResults: auditResultsResult.data || [],
        auditFailures: auditFailuresResult.data || [],
      };
    } catch (error) {
      console.error('Error fetching audit summary:', error);
      throw error;
    }
  }
}

export const auditDataVerification = new AuditDataVerification();
