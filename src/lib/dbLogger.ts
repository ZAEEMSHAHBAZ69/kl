import { supabase } from './supabase';

export interface DbLog {
  timestamp?: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  operation: string;
  table?: string;
  status: 'success' | 'failure';
  message: string;
  details?: Record<string, any>;
  error?: string;
  duration_ms?: number;
  recordCount?: number;
}

class DatabaseLogger {
  async logOperation(log: DbLog): Promise<void> {
    try {
      const dbLog = {
        timestamp: log.timestamp || new Date().toISOString(),
        level: log.level,
        operation: log.operation,
        table_name: log.table,
        status: log.status,
        message: log.message,
        details: log.details || {},
        error_message: log.error,
        duration_ms: log.duration_ms,
        record_count: log.recordCount,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('db_operation_logs')
        .insert(dbLog);

      if (error) {
        console.error('Failed to log database operation:', error);
      }
    } catch (err) {
      console.error('Error logging database operation:', err);
    }
  }

  async logInsert(
    table: string,
    recordCount: number,
    duration: number,
    success: boolean,
    error?: any,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logOperation({
      level: success ? 'INFO' : 'ERROR',
      operation: 'INSERT',
      table,
      status: success ? 'success' : 'failure',
      message: `${success ? 'Successfully' : 'Failed to'} insert ${recordCount} record(s) into ${table}`,
      error: error?.message || undefined,
      duration_ms: duration,
      recordCount,
      details,
    });
  }

  async logUpdate(
    table: string,
    recordCount: number,
    duration: number,
    success: boolean,
    error?: any,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logOperation({
      level: success ? 'INFO' : 'ERROR',
      operation: 'UPDATE',
      table,
      status: success ? 'success' : 'failure',
      message: `${success ? 'Successfully' : 'Failed to'} update ${recordCount} record(s) in ${table}`,
      error: error?.message || undefined,
      duration_ms: duration,
      recordCount,
      details,
    });
  }

  async logSelect(
    table: string,
    recordCount: number,
    duration: number,
    success: boolean,
    error?: any,
    filters?: Record<string, any>
  ): Promise<void> {
    await this.logOperation({
      level: success ? 'INFO' : 'ERROR',
      operation: 'SELECT',
      table,
      status: success ? 'success' : 'failure',
      message: `${success ? 'Successfully' : 'Failed to'} fetch ${recordCount} record(s) from ${table}`,
      error: error?.message || undefined,
      duration_ms: duration,
      recordCount,
      details: filters,
    });
  }

  async logDelete(
    table: string,
    recordCount: number,
    duration: number,
    success: boolean,
    error?: any,
    filters?: Record<string, any>
  ): Promise<void> {
    await this.logOperation({
      level: success ? 'INFO' : 'ERROR',
      operation: 'DELETE',
      table,
      status: success ? 'success' : 'failure',
      message: `${success ? 'Successfully' : 'Failed to'} delete ${recordCount} record(s) from ${table}`,
      error: error?.message || undefined,
      duration_ms: duration,
      recordCount,
      details: filters,
    });
  }
}

export const dbLogger = new DatabaseLogger();
