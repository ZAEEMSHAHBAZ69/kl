import { supabase } from './supabase';
import { createAuditLog } from './auditService';

export enum DeletionType {
  PUBLISHER = 'publisher',
  USER = 'user'
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  PARTNER = 'partner'
}

export interface DeletionRequest {
  entityId: string;
  entityType: DeletionType;
  userId: string;
  reason?: string;
  forceDelete?: boolean;
}

export interface DeletionResult {
  success: boolean;
  message: string;
  backupId?: string;
  affectedRecords?: number;
  error?: string;
}

export interface BackupData {
  id: string;
  entityType: DeletionType;
  entityId: string;
  data: any;
  relatedData: any[];
  createdAt: string;
  createdBy: string;
}

class DeletionService {
  private async getUserRole(userId: string): Promise<UserRole | null> {
    const { data, error } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      console.error('getUserRole error:', error, 'userId:', userId);
      return null;
    }
    console.log('getUserRole result:', data.role, 'for user:', userId);
    return data.role as UserRole;
  }

  private async getUserId(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('app_users')
      .select('user_id')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data.user_id;
  }

  private async verifyOwnership(entityType: DeletionType, entityId: string, userId: string): Promise<boolean> {
    const userRole = await this.getUserRole(userId);
    
    // Super admins and admins can delete anything
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return true;
    }

    // Partners can only delete their own publishers
    if (userRole === UserRole.PARTNER && entityType === DeletionType.PUBLISHER) {
      const userIdFromAppUser = await this.getUserId(userId);
      if (!userIdFromAppUser) return false;

      const { data, error } = await supabase
        .from('publishers')
        .select('partner_id')
        .eq('id', entityId)
        .single();

      return !error && data?.partner_id === userIdFromAppUser;
    }

    return false;
  }

  private async createBackup(entityType: DeletionType, entityId: string, userId: string): Promise<string | null> {
    try {
      let mainData: any = null;
      let relatedData: any[] = [];

      switch (entityType) {
        case DeletionType.PUBLISHER:
          // Backup publisher data
          const { data: publisher } = await supabase
            .from('publishers')
            .select('*')
            .eq('id', entityId)
            .single();
          
          if (!publisher) throw new Error('Publisher not found');
          mainData = publisher;

          // Backup related data
          const { data: reportsDaily } = await supabase
            .from('reports_daily')
            .select('*')
            .eq('publisher_id', entityId);

          const { data: reportsDimensional } = await supabase
            .from('reports_dimensional')
            .select('*')
            .eq('publisher_id', entityId);

          const { data: reportsHistorical } = await supabase
            .from('report_historical')
            .select('*')
            .eq('publisher_id', entityId);

          const { data: alerts } = await supabase
            .from('alerts')
            .select('*')
            .eq('publisher_id', entityId);

          const { data: mfaScores } = await supabase
            .from('mfa_composite_scores')
            .select('*')
            .eq('publisher_id', entityId);

          const { data: siteAudits } = await supabase
            .from('site_audits')
            .select('*')
            .eq('publisher_id', entityId);

          relatedData = [
            { table: 'reports_daily', data: reportsDaily || [] },
            { table: 'reports_dimensional', data: reportsDimensional || [] },
            { table: 'report_historical', data: reportsHistorical || [] },
            { table: 'alerts', data: alerts || [] },
            { table: 'mfa_composite_scores', data: mfaScores || [] },
            { table: 'site_audits', data: siteAudits || [] }
          ];
          break;

        case DeletionType.USER:
          // Backup user data
          const { data: user } = await supabase
            .from('app_users')
            .select('*')
            .eq('id', entityId)
            .single();
          
          if (!user) throw new Error('User not found');
          mainData = user;
          break;
      }

      // Store backup in a dedicated backup table or storage
      const backupData: BackupData = {
        id: crypto.randomUUID(),
        entityType,
        entityId,
        data: mainData,
        relatedData,
        createdAt: new Date().toISOString(),
        createdBy: userId
      };

      // For now, we'll store in a JSON format - in production, consider encrypted storage
      const { data: backup, error } = await supabase
        .from('deletion_backups')
        .insert(backupData)
        .select()
        .single();

      if (error) throw error;
      return backup.id;

    } catch (error) {
      console.error('Backup creation failed:', error);
      return null;
    }
  }

  async deletePublisher(publisherId: string, userId: string): Promise<DeletionResult> {
    try {
      const userRole = await this.getUserRole(userId);
      
      // Verify ownership or admin privileges
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPER_ADMIN) {
        const hasOwnership = await this.verifyOwnership(DeletionType.PUBLISHER, publisherId, userId);
        if (!hasOwnership) {
          await createAuditLog({
            userId: userId,
            action: 'DELETE_DENIED',
            entityType: 'publisher',
            entityId: publisherId,
            details: { reason: 'Insufficient permissions' }
          });
          return {
            success: false,
            message: 'Insufficient permissions to delete this publisher',
            error: 'Insufficient permissions to delete this publisher'
          };
        }
      }

      // Get publisher data for backup
      const { data: publisherData, error: fetchError } = await supabase
        .from('publishers')
        .select('*')
        .eq('id', publisherId)
        .single();

      if (fetchError || !publisherData) {
        return {
          success: false,
          message: 'Publisher not found or access denied',
          error: 'Publisher not found or access denied'
        };
      }

      // Start transaction-like operations
      let affectedRecords = 0;

      // Delete related data first (maintain referential integrity)
      const { error: reportsDailyError } = await supabase
        .from('reports_daily')
        .delete()
        .eq('publisher_id', publisherId);

      if (reportsDailyError) throw reportsDailyError;

      const { error: reportsDimensionalError } = await supabase
        .from('reports_dimensional')
        .delete()
        .eq('publisher_id', publisherId);

      if (reportsDimensionalError) throw reportsDimensionalError;

      const { error: reportsHistoricalError } = await supabase
        .from('report_historical')
        .delete()
        .eq('publisher_id', publisherId);

      if (reportsHistoricalError) throw reportsHistoricalError;

      const { error: alertsError } = await supabase
        .from('alerts')
        .delete()
        .eq('publisher_id', publisherId);

      if (alertsError) throw alertsError;

      const { error: mfaScoresError } = await supabase
        .from('mfa_composite_scores')
        .delete()
        .eq('publisher_id', publisherId);

      if (mfaScoresError) throw mfaScoresError;

      const { error: siteAuditsError } = await supabase
        .from('site_audits')
        .delete()
        .eq('publisher_id', publisherId);

      if (siteAuditsError) throw siteAuditsError;

      // Delete GAM invitations if they exist
      const { error: gamError } = await supabase
        .from('gam_invitations')
        .delete()
        .eq('publisher_id', publisherId);

      if (gamError) throw gamError;

      // Finally delete the publisher
      const { error: publisherError, count } = await supabase
        .from('publishers')
        .delete()
        .eq('id', publisherId)
        .select();

      if (publisherError) throw publisherError;
      affectedRecords = count || 0;

      // Log the deletion with detailed information
      await createAuditLog({
        userId: userId,
        action: 'DELETE_SUCCESS',
        entityType: 'publisher',
        entityId: publisherId,
        details: {
          publisher_name: publisherData.name,
          partner_id: publisherData.partner_id,
          affected_records: affectedRecords
        }
      });

      return {
        success: true,
        message: `Publisher "${publisherData.name}" and related records deleted successfully`,
        affectedRecords
      };

    } catch (error: any) {
      console.error('Publisher deletion error:', error);
      return {
        success: false,
        message: 'Failed to delete publisher',
        error: error.message
      };
    }
  }

  async deleteUser(targetUserId: string, requestingUserId: string): Promise<DeletionResult> {
    try {
      const userRole = await this.getUserRole(requestingUserId);

      // Only admins can delete users
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPER_ADMIN) {
        await createAuditLog({
          userId: requestingUserId,
          action: 'DELETE_DENIED',
          entityType: 'user',
          entityId: targetUserId,
          details: { reason: 'Insufficient permissions' }
        });
        return {
          success: false,
          message: 'Only administrators can delete users',
          error: 'Only administrators can delete users'
        };
      }

      // Get user data and all related data for backup
      const { data: userData, error: fetchError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle();

      // Check if user is orphaned (exists in auth.users but not app_users)
      if (!userData) {
        // User might be orphaned - exists in auth.users only
        const { data: authUser, error: authCheckError } = await supabase.auth.admin.getUserById(targetUserId);

        if (authCheckError || !authUser) {
          return {
            success: false,
            message: 'User not found in system',
            error: 'User not found or access denied'
          };
        }

        // User is orphaned - delete from auth.users only
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(targetUserId);

        if (authDeleteError) {
          console.error('Failed to delete orphaned user from auth.users:', authDeleteError);
          return {
            success: false,
            message: 'Failed to delete orphaned user',
            error: authDeleteError.message
          };
        }

        // Log successful cleanup of orphaned user
        await createAuditLog({
          userId: requestingUserId,
          action: 'DELETE_SUCCESS',
          entityType: 'user',
          entityId: targetUserId,
          details: {
            user_email: authUser.user.email,
            user_type: 'orphaned',
            note: 'Deleted orphaned user (existed in auth.users but not app_users)'
          }
        });

        return {
          success: true,
          message: `Orphaned user "${authUser.user.email}" removed from authentication system`,
          affectedRecords: 1
        };
      }

      if (fetchError) {
        return {
          success: false,
          message: 'User not found or access denied',
          error: 'User not found or access denied'
        };
      }

      // Admins cannot delete other admins
      if (userRole === UserRole.ADMIN && userData.role === 'admin') {
        return {
          success: false,
          message: 'Admins cannot delete other admin users',
          error: 'Insufficient permissions'
        };
      }

      let affectedRecords = 0;

      // Delete from auth.users first (this is the user account)
      const { error: authError } = await supabase.auth.admin.deleteUser(targetUserId);
      if (authError) {
        console.error('Failed to delete from auth.users:', authError);
      }

      // Delete from app_users (this will cascade to related records due to foreign key constraints)
      const { error, count } = await supabase
        .from('app_users')
        .delete()
        .eq('id', targetUserId)
        .select();

      if (error) throw error;
      affectedRecords = count || 0;

      // Log the deletion with detailed information
      await createAuditLog({
        userId: requestingUserId,
        action: 'DELETE_SUCCESS',
        entityType: 'user',
        entityId: targetUserId,
        details: {
          user_name: userData.full_name || userData.email,
          user_role: userData.role,
          affected_records: affectedRecords
        }
      });

      return {
        success: true,
        message: `User "${userData.full_name || userData.email}" and all associated data deleted successfully`,
        affectedRecords
      };

    } catch (error: any) {
      console.error('User deletion error:', error);
      return {
        success: false,
        message: 'Failed to delete user',
        error: error.message
      };
    }
  }


  public async deleteEntity(request: DeletionRequest): Promise<DeletionResult> {
    try {
      // Verify permissions
      const hasPermission = await this.verifyOwnership(
        request.entityType,
        request.entityId,
        request.userId
      );

      if (!hasPermission) {
        await createAuditLog({
          userId: request.userId,
          action: 'DELETE_DENIED',
          entityType: request.entityType,
          entityId: request.entityId,
          details: { reason: 'Insufficient permissions' }
        });

        return {
          success: false,
          message: 'You do not have permission to delete this entity',
          error: 'Insufficient permissions'
        };
      }

      // Create backup before deletion
      const backupId = await this.createBackup(
        request.entityType,
        request.entityId,
        request.userId
      );

      if (!backupId && !request.forceDelete) {
        return {
          success: false,
          message: 'Failed to create backup. Use forceDelete to proceed without backup.',
          error: 'Backup creation failed'
        };
      }

      // Perform deletion based on entity type
      let result: DeletionResult;
      switch (request.entityType) {
        case DeletionType.PUBLISHER:
          result = await this.deletePublisher(request.entityId, request.userId);
          break;
        case DeletionType.USER:
          result = await this.deleteUser(request.entityId, request.userId);
          break;
        default:
          return {
            success: false,
            message: 'Invalid entity type',
            error: 'Invalid entity type'
          };
      }

      // Log the deletion attempt
      await createAuditLog({
        userId: request.userId,
        action: result.success ? 'DELETE_SUCCESS' : 'DELETE_FAILED',
        entityType: request.entityType,
        entityId: request.entityId,
        details: {
          reason: request.reason,
          backupId,
          affectedRecords: result.affectedRecords,
          error: result.error
        }
      });

      if (result.success && backupId) {
        result.backupId = backupId;
      }

      return result;

    } catch (error: any) {
      await createAuditLog({
        userId: request.userId,
        action: 'DELETE_ERROR',
        entityType: request.entityType,
        entityId: request.entityId,
        details: { error: error.message }
      });

      return {
        success: false,
        message: 'An unexpected error occurred during deletion',
        error: error.message
      };
    }
  }

  public async restoreFromBackup(_backupId: string, userId: string): Promise<DeletionResult> {
    try {
      const userRole = await this.getUserRole(userId);
      if (userRole !== UserRole.SUPER_ADMIN) {
        return {
          success: false,
          message: 'Only super administrators can restore from backups',
          error: 'Insufficient permissions'
        };
      }

      // Implementation for restore functionality
      // This would involve reading the backup and recreating the entities
      // For now, return a placeholder response
      return {
        success: false,
        message: 'Restore functionality not yet implemented',
        error: 'Feature not available'
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to restore from backup',
        error: error.message
      };
    }
  }

  // Permanent deletion methods without backup retention
  async deleteUserPermanent(targetUserId: string, requestingUserId: string): Promise<DeletionResult> {
    try {
      const userRole = await this.getUserRole(requestingUserId);

      // Only admins can delete users
       if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPER_ADMIN) {
         await createAuditLog({
           userId: requestingUserId,
           action: 'DELETE_DENIED',
           entityType: 'user',
           entityId: targetUserId,
           details: { reason: 'Insufficient permissions' }
         });
         return {
           success: false,
           message: 'Only administrators can delete users',
           error: 'Only administrators can delete users'
         };
       }

      // Get user data for logging
      const { data: userData, error: fetchError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle();

      // Check if user is orphaned (exists in auth.users but not app_users)
      if (!userData) {
        // User might be orphaned - exists in auth.users only
        const { data: authUser, error: authCheckError } = await supabase.auth.admin.getUserById(targetUserId);

        if (authCheckError || !authUser) {
          return {
            success: false,
            message: 'User not found in system',
            error: 'User not found or access denied'
          };
        }

        // User is orphaned - delete from auth.users only
        const { error: authDeleteError } = await supabase.auth.admin.deleteUser(targetUserId);

        if (authDeleteError) {
          console.error('Failed to delete orphaned user from auth.users:', authDeleteError);
          return {
            success: false,
            message: 'Failed to delete orphaned user',
            error: authDeleteError.message
          };
        }

        // Log successful cleanup of orphaned user
        await createAuditLog({
          userId: requestingUserId,
          action: 'DELETE_PERMANENT',
          entityType: 'user',
          entityId: targetUserId,
          details: {
            user_email: authUser.user.email,
            user_type: 'orphaned',
            permanent: true,
            note: 'Permanently deleted orphaned user (existed in auth.users but not app_users)'
          }
        });

        return {
          success: true,
          message: `Orphaned user "${authUser.user.email}" permanently removed from authentication system`,
          affectedRecords: 1
        };
      }

      if (fetchError) {
        return {
          success: false,
          message: 'User not found or access denied',
          error: 'User not found or access denied'
        };
      }

      // Admins cannot delete other admins
      if (userRole === UserRole.ADMIN && userData.role === 'admin') {
        return {
          success: false,
          message: 'Admins cannot delete other admin users',
          error: 'Insufficient permissions'
        };
      }

      // Create backup before permanent deletion
      const backupId = await this.createBackup(DeletionType.USER, targetUserId, requestingUserId);
      if (!backupId) {
        console.warn('Failed to create backup for user deletion, proceeding anyway');
      }

      let affectedRecords = 0;

      // Delete from auth.users first (this is the user account)
      const { error: authError } = await supabase.auth.admin.deleteUser(targetUserId);
      if (authError) {
        console.error('Failed to delete from auth.users:', authError);
      }

      // Delete from app_users (this will cascade to related records due to foreign key constraints)
      const { error, count } = await supabase
        .from('app_users')
        .delete()
        .eq('id', targetUserId)
        .select();

      if (error) throw error;
      affectedRecords = count || 0;

      // Log the permanent deletion
       await createAuditLog({
         userId: requestingUserId,
         action: 'DELETE_PERMANENT',
         entityType: 'user',
         entityId: targetUserId,
         details: {
           user_name: userData.full_name || userData.email,
           user_role: userData.role,
           affected_records: affectedRecords,
           permanent: true
         }
       });

      return {
        success: true,
        message: `User "${userData.full_name || userData.email}" and all associated data permanently deleted`,
        affectedRecords,
        backupId: backupId || undefined
      };

    } catch (error: any) {
      console.error('User permanent deletion error:', error);
      return {
        success: false,
        message: 'Failed to permanently delete user',
        error: error.message
      };
    }
  }

  async deleteAdminUserPermanent(userId: string, requestingUserId: string): Promise<DeletionResult> {
    try {
      // Only super admins can delete admin users
      const requestingUserRole = await this.getUserRole(requestingUserId);
      if (requestingUserRole !== UserRole.SUPER_ADMIN) {
        return {
          success: false,
          message: 'Only super administrators can delete admin users',
          error: 'Insufficient permissions'
        };
      }

      // Get user data for logging
      const { data: userData, error: fetchError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError || !userData) {
        return {
          success: false,
          message: 'User not found or access denied',
          error: 'User not found or access denied'
        };
      }

      // Only allow deletion of admin and partner users, not super admins
      if (userData.role === UserRole.SUPER_ADMIN) {
        return {
          success: false,
          message: 'Cannot delete super administrator users',
          error: 'Cannot delete super administrator users'
        };
      }

      // Create backup before permanent deletion
      const backupId = await this.createBackup(DeletionType.USER, userId, requestingUserId);
      if (!backupId) {
        console.warn('Failed to create backup for user deletion, proceeding anyway');
      }

      let affectedRecords = 0;

      // Delete from auth.users first (this is the user account)
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        console.error('Failed to delete from auth.users:', authError);
      }

      // Delete from app_users (this will cascade to related records due to foreign key constraints)
      const { error, count } = await supabase
        .from('app_users')
        .delete()
        .eq('id', userId)
        .select();

      if (error) throw error;
      affectedRecords = count || 0;

      // Log the permanent deletion
       await createAuditLog({
         userId: requestingUserId,
         action: 'DELETE_PERMANENT',
         entityType: 'user',
         entityId: userId,
         details: {
           user_email: userData.email,
           user_role: userData.role,
           user_name: userData.full_name || userData.name,
           affected_records: affectedRecords,
           permanent: true
         }
       });

      return {
        success: true,
        message: `User "${userData.full_name || userData.email}" permanently deleted`,
        affectedRecords,
        backupId: backupId || undefined
      };

    } catch (error: any) {
      console.error('User permanent deletion error:', error);
      return {
        success: false,
        message: 'Failed to permanently delete user',
        error: error.message
      };
    }
  }

  // Enhanced deleteEntity method with permanent deletion option
  public async deleteEntityPermanent(request: DeletionRequest): Promise<DeletionResult> {
    try {
      // Verify permissions
      const hasPermission = await this.verifyOwnership(
        request.entityType,
        request.entityId,
        request.userId
      );

      if (!hasPermission) {
         await createAuditLog({
           userId: request.userId,
           action: 'DELETE_DENIED',
           entityType: request.entityType,
           entityId: request.entityId,
           details: { reason: 'Insufficient permissions' }
         });

        return {
          success: false,
          message: 'You do not have permission to delete this entity',
          error: 'Insufficient permissions'
        };
      }

      // Perform permanent deletion based on entity type
      let result: DeletionResult;
      switch (request.entityType) {
        case DeletionType.USER:
          result = await this.deleteUserPermanent(request.entityId, request.userId);
          break;
        default:
          return {
            success: false,
            message: 'Permanent deletion not supported for this entity type',
            error: 'Permanent deletion not supported for this entity type'
          };
      }

      return result;

    } catch (error: any) {
       await createAuditLog({
         userId: request.userId,
         action: 'DELETE_ERROR',
         entityType: request.entityType,
         entityId: request.entityId,
         details: { error: error.message, permanent: true }
       });

      return {
        success: false,
        message: 'An unexpected error occurred during permanent deletion',
        error: error.message
      };
    }
  }
}

export const deletionService = new DeletionService();
