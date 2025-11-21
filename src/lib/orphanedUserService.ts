import { supabase } from './supabase';
import { createAuditLog } from './auditService';

export interface OrphanedUser {
  userId: string;
  email: string;
  createdAt: string;
  confirmedAt: string | null;
}

export interface OrphanedUserCleanupResult {
  success: boolean;
  message: string;
  cleanedUsers?: OrphanedUser[];
  errorUsers?: { userId: string; email: string; error: string }[];
  totalCleaned: number;
  totalFailed: number;
}

class OrphanedUserService {
  async getOrphanedUsers(): Promise<OrphanedUser[]> {
    try {
      const { data, error } = await supabase.rpc('get_orphaned_users');

      if (error) {
        console.error('Failed to get orphaned users:', error);
        return [];
      }

      return (data || []).map((user: any) => ({
        userId: user.user_id,
        email: user.email,
        createdAt: user.created_at,
        confirmedAt: user.confirmed_at
      }));
    } catch (error) {
      console.error('Error fetching orphaned users:', error);
      return [];
    }
  }

  async isUserOrphaned(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('is_user_orphaned', {
        check_user_id: userId
      });

      if (error) {
        console.error('Failed to check if user is orphaned:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error checking orphaned user status:', error);
      return false;
    }
  }

  async cleanupOrphanedUsers(requestingUserId: string): Promise<OrphanedUserCleanupResult> {
    try {
      const orphanedUsers = await this.getOrphanedUsers();

      if (orphanedUsers.length === 0) {
        return {
          success: true,
          message: 'No orphaned users found',
          cleanedUsers: [],
          totalCleaned: 0,
          totalFailed: 0
        };
      }

      const cleanedUsers: OrphanedUser[] = [];
      const errorUsers: { userId: string; email: string; error: string }[] = [];

      for (const orphanedUser of orphanedUsers) {
        try {
          const { error: deleteError } = await supabase.auth.admin.deleteUser(
            orphanedUser.userId
          );

          if (deleteError) {
            console.error(`Failed to delete orphaned user ${orphanedUser.email}:`, deleteError);
            errorUsers.push({
              userId: orphanedUser.userId,
              email: orphanedUser.email,
              error: deleteError.message
            });
            continue;
          }

          await createAuditLog({
            userId: requestingUserId,
            action: 'CLEANUP_ORPHANED_USER',
            entityType: 'user',
            entityId: orphanedUser.userId,
            details: {
              email: orphanedUser.email,
              created_at: orphanedUser.createdAt,
              note: 'Cleaned up orphaned user (existed in auth.users but not app_users)'
            }
          });

          cleanedUsers.push(orphanedUser);
        } catch (error: any) {
          console.error(`Error cleaning up orphaned user ${orphanedUser.email}:`, error);
          errorUsers.push({
            userId: orphanedUser.userId,
            email: orphanedUser.email,
            error: error.message || 'Unknown error'
          });
        }
      }

      const totalCleaned = cleanedUsers.length;
      const totalFailed = errorUsers.length;

      return {
        success: totalFailed === 0,
        message: `Cleaned up ${totalCleaned} orphaned user(s)${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`,
        cleanedUsers,
        errorUsers: totalFailed > 0 ? errorUsers : undefined,
        totalCleaned,
        totalFailed
      };
    } catch (error: any) {
      console.error('Orphaned user cleanup error:', error);
      return {
        success: false,
        message: 'Failed to cleanup orphaned users',
        totalCleaned: 0,
        totalFailed: orphanedUsers?.length || 0
      };
    }
  }

  async cleanupSingleOrphanedUser(
    userId: string,
    requestingUserId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const isOrphaned = await this.isUserOrphaned(userId);

      if (!isOrphaned) {
        return {
          success: false,
          message: 'User is not orphaned or does not exist'
        };
      }

      const { data: authUser, error: getUserError } = await supabase.auth.admin.getUserById(userId);

      if (getUserError || !authUser) {
        return {
          success: false,
          message: 'User not found in authentication system'
        };
      }

      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) {
        console.error('Failed to delete orphaned user:', deleteError);
        return {
          success: false,
          message: `Failed to delete orphaned user: ${deleteError.message}`
        };
      }

      await createAuditLog({
        userId: requestingUserId,
        action: 'CLEANUP_ORPHANED_USER',
        entityType: 'user',
        entityId: userId,
        details: {
          email: authUser.user.email,
          note: 'Cleaned up orphaned user (existed in auth.users but not app_users)'
        }
      });

      return {
        success: true,
        message: `Orphaned user "${authUser.user.email}" successfully removed`
      };
    } catch (error: any) {
      console.error('Error cleaning up single orphaned user:', error);
      return {
        success: false,
        message: error.message || 'Failed to cleanup orphaned user'
      };
    }
  }
}

export const orphanedUserService = new OrphanedUserService();
