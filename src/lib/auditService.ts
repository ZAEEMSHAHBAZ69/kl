import { supabase } from './supabase';

export interface AuditLogEntry {
  id?: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp?: string;
  ipAddress?: string;
  userAgent?: string;
  userEmail?: string;
  details?: any;
  preState?: any;
  postState?: any;
}

export interface AuditLogFilter {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export enum AuditAction {
  // Deletion actions
  DELETE_INITIATED = 'DELETE_INITIATED',
  DELETE_PUBLISHER = 'DELETE_PUBLISHER',
  DELETE_PARTNER = 'DELETE_PARTNER',
  DELETE_USER = 'DELETE_USER',
  DELETE_SUCCESS = 'DELETE_SUCCESS',
  DELETE_FAILED = 'DELETE_FAILED',
  DELETE_DENIED = 'DELETE_DENIED',
  DELETE_ERROR = 'DELETE_ERROR',
  
  // Backup actions
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_FAILED = 'BACKUP_FAILED',
  RESTORE_INITIATED = 'RESTORE_INITIATED',
  RESTORE_SUCCESS = 'RESTORE_SUCCESS',
  RESTORE_FAILED = 'RESTORE_FAILED',
  
  // Publisher actions
  PUBLISHER_CREATED = 'PUBLISHER_CREATED',
  PUBLISHER_UPDATED = 'PUBLISHER_UPDATED',
  PUBLISHER_STATUS_CHANGED = 'PUBLISHER_STATUS_CHANGED',
  
  // Partner actions
  PARTNER_CREATED = 'PARTNER_CREATED',
  PARTNER_UPDATED = 'PARTNER_UPDATED',
  PARTNER_REVOKED = 'PARTNER_REVOKED',
  
  // User actions
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  
  // Permission actions
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS'
}

class AuditService {
  private async getUserInfo(userId: string) {
    try {
      const { data } = await supabase
        .from('app_users')
        .select('email, full_name, role')
        .eq('id', userId)
        .single();
      
      return data;
    } catch (error) {
      return null;
    }
  }

  private async getEntityState(entityType: string, entityId: string) {
    try {
      let tableName = '';
      switch (entityType.toLowerCase()) {
        case 'publisher':
          tableName = 'publishers';
          break;
        case 'partner':
        case 'user':
          tableName = 'app_users';
          break;
        default:
          return null;
      }

      const { data } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', entityId)
        .single();

      return data;
    } catch (error) {
      return null;
    }
  }

  public async createAuditLog(entry: AuditLogEntry): Promise<boolean> {
    try {
      // Get user information for context
      const userInfo = await this.getUserInfo(entry.userId);
      
      // Get current state of entity if it exists
      const currentState = await this.getEntityState(entry.entityType, entry.entityId);
      
      // Prepare audit log entry
      const auditEntry = {
        id: crypto.randomUUID(),
        user_id: entry.userId,
        user_email: userInfo?.email || 'unknown',
        user_role: userInfo?.role || 'unknown',
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        timestamp: entry.timestamp || new Date().toISOString(),
        ip_address: entry.ipAddress || 'unknown',
        user_agent: entry.userAgent || 'unknown',
        details: entry.details || {},
        pre_state: entry.preState || currentState,
        post_state: entry.postState,
        created_at: new Date().toISOString()
      };

      // Insert into audit_logs table
      const { error } = await supabase
        .from('audit_logs')
        .insert(auditEntry);

      if (error) {
        console.error('Failed to create audit log:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Audit logging error:', error);
      return false;
    }
  }

  public async getAuditLogs(filter: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply filters
      if (filter.userId) {
        query = query.eq('user_id', filter.userId);
      }
      
      if (filter.action) {
        query = query.eq('action', filter.action);
      }
      
      if (filter.entityType) {
        query = query.eq('entity_type', filter.entityType);
      }
      
      if (filter.entityId) {
        query = query.eq('entity_id', filter.entityId);
      }
      
      if (filter.startDate) {
        query = query.gte('timestamp', filter.startDate);
      }
      
      if (filter.endDate) {
        query = query.lte('timestamp', filter.endDate);
      }

      // Apply pagination
      if (filter.limit) {
        query = query.limit(filter.limit);
      }
      
      if (filter.offset) {
        query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch audit logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }

  public async getDeletionHistory(entityType?: string, entityId?: string): Promise<AuditLogEntry[]> {
    const deletionActions = [
      AuditAction.DELETE_PUBLISHER,
      AuditAction.DELETE_PARTNER,
      AuditAction.DELETE_USER,
      AuditAction.DELETE_SUCCESS,
      AuditAction.DELETE_FAILED,
      AuditAction.DELETE_DENIED
    ];

    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .in('action', deletionActions)
        .order('timestamp', { ascending: false });

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      if (entityId) {
        query = query.eq('entity_id', entityId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch deletion history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching deletion history:', error);
      return [];
    }
  }

  public async getUserActivity(userId: string, days: number = 30): Promise<AuditLogEntry[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getAuditLogs({
      userId,
      startDate: startDate.toISOString(),
      limit: 100
    });
  }

  public async getEntityHistory(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    return this.getAuditLogs({
      entityType,
      entityId,
      limit: 50
    });
  }

  public async createDeletionAuditTrail(
    userId: string,
    entityType: string,
    entityId: string,
    preState: any,
    reason?: string
  ): Promise<boolean> {
    return this.createAuditLog({
      userId,
      action: AuditAction.DELETE_INITIATED,
      entityType,
      entityId,
      preState,
      details: {
        reason,
        timestamp: new Date().toISOString(),
        initiatedBy: userId
      }
    });
  }

  public async logPermissionDenied(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    reason: string
  ): Promise<boolean> {
    return this.createAuditLog({
      userId,
      action: AuditAction.PERMISSION_DENIED,
      entityType,
      entityId,
      details: {
        attemptedAction: action,
        denialReason: reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  public async generateAuditReport(
    startDate: string,
    endDate: string,
    entityType?: string
  ): Promise<{
    totalActions: number;
    deletions: number;
    failures: number;
    topUsers: Array<{ userId: string; email: string; actionCount: number }>;
    actionBreakdown: Array<{ action: string; count: number }>;
  }> {
    try {
      const filter: AuditLogFilter = {
        startDate,
        endDate,
        limit: 10000
      };

      if (entityType) {
        filter.entityType = entityType;
      }

      const logs = await this.getAuditLogs(filter);

      // Calculate statistics
      const totalActions = logs.length;
      const deletions = logs.filter(log => 
        log.action.includes('DELETE') && log.action.includes('SUCCESS')
      ).length;
      const failures = logs.filter(log => 
        log.action.includes('FAILED') || log.action.includes('ERROR')
      ).length;

      // Top users by activity
      const userActivity = logs.reduce((acc, log) => {
        const key = `${log.userId}:${log.userEmail}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topUsers = Object.entries(userActivity)
        .map(([key, count]) => {
          const [userId, email] = key.split(':');
          return { userId, email, actionCount: count };
        })
        .sort((a, b) => b.actionCount - a.actionCount)
        .slice(0, 10);

      // Action breakdown
      const actionCounts = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const actionBreakdown = Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalActions,
        deletions,
        failures,
        topUsers,
        actionBreakdown
      };
    } catch (error) {
      console.error('Error generating audit report:', error);
      return {
        totalActions: 0,
        deletions: 0,
        failures: 0,
        topUsers: [],
        actionBreakdown: []
      };
    }
  }
}

// Helper function for easy import
export const createAuditLog = async (entry: AuditLogEntry): Promise<boolean> => {
  return auditService.createAuditLog(entry);
};

export const auditService = new AuditService();