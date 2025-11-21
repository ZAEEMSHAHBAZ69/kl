import { supabase } from './supabase';

export interface SyncStatus {
  totalAuthUsers: number;
  totalAppUsers: number;
  orphanedAuthUsersCount: number;
  reverseOrphanedUsersCount: number;
  syncedUsersCount: number;
}

export interface OrphanedAuthUser {
  userId: string;
  email: string;
  createdAt: string;
  confirmedAt: string | null;
  lastSignInAt: string | null;
}

export interface DetailedUserInfo {
  authUserId: string | null;
  authEmail: string | null;
  authCreatedAt: string | null;
  authLastSignInAt: string | null;
  appUserId: string | null;
  appUserEmail: string | null;
  appUserFullName: string | null;
  appUserRole: string | null;
  appUserCreatedAt: string | null;
  syncStatus: 'orphaned_in_auth' | 'orphaned_in_app' | 'synced';
}

class UserSyncService {
  async getSyncStatus(): Promise<SyncStatus | null> {
    try {
      const { data, error } = await supabase.rpc('get_user_sync_status');

      if (error) {
        console.error('Failed to get sync status:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const status = data[0];
      return {
        totalAuthUsers: status.total_auth_users || 0,
        totalAppUsers: status.total_app_users || 0,
        orphanedAuthUsersCount: status.orphaned_auth_users_count || 0,
        reverseOrphanedUsersCount: status.reverse_orphaned_users_count || 0,
        syncedUsersCount: status.synced_users_count || 0
      };
    } catch (error) {
      console.error('Error fetching sync status:', error);
      return null;
    }
  }

  async getOrphanedAuthUsers(): Promise<OrphanedAuthUser[]> {
    try {
      const { data, error } = await supabase.rpc('get_orphaned_auth_users');

      if (error) {
        console.error('Failed to get orphaned auth users:', error);
        return [];
      }

      return (data || []).map((user: any) => ({
        userId: user.user_id,
        email: user.email,
        createdAt: user.created_at,
        confirmedAt: user.confirmed_at,
        lastSignInAt: user.last_sign_in_at
      }));
    } catch (error) {
      console.error('Error fetching orphaned auth users:', error);
      return [];
    }
  }

  async getReverseOrphanedUsers(): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('get_reverse_orphaned_users');

      if (error) {
        console.error('Failed to get reverse orphaned users:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching reverse orphaned users:', error);
      return [];
    }
  }

  async getDetailedUserInfo(userId: string): Promise<DetailedUserInfo | null> {
    try {
      const { data, error } = await supabase.rpc('get_detailed_user_info', {
        target_user_id: userId
      });

      if (error) {
        console.error('Failed to get detailed user info:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const info = data[0];
      return {
        authUserId: info.auth_user_id,
        authEmail: info.auth_email,
        authCreatedAt: info.auth_created_at,
        authLastSignInAt: info.auth_last_sign_in_at,
        appUserId: info.app_user_id,
        appUserEmail: info.app_user_email,
        appUserFullName: info.app_user_full_name,
        appUserRole: info.app_user_role,
        appUserCreatedAt: info.app_user_created_at,
        syncStatus: info.sync_status
      };
    } catch (error) {
      console.error('Error fetching detailed user info:', error);
      return null;
    }
  }

  async deleteOrphanedAuthUser(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if user is orphaned
      const orphanedUsers = await this.getOrphanedAuthUsers();
      const isOrphaned = orphanedUsers.some(u => u.userId === userId);

      if (!isOrphaned) {
        return {
          success: false,
          message: 'User is not orphaned or does not exist in auth.users'
        };
      }

      // Get user data before deletion
      const { data: authUser, error: getUserError } = await supabase.auth.admin.getUserById(userId);

      if (getUserError || !authUser?.user) {
        return {
          success: false,
          message: 'User not found in authentication system'
        };
      }

      // Delete the orphaned user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) {
        console.error('Failed to delete orphaned user:', deleteError);
        return {
          success: false,
          message: `Failed to delete orphaned user: ${deleteError.message}`
        };
      }

      return {
        success: true,
        message: `Orphaned user "${authUser.user.email}" successfully removed from authentication system`
      };
    } catch (error: any) {
      console.error('Error deleting orphaned user:', error);
      return {
        success: false,
        message: error.message || 'Failed to delete orphaned user'
      };
    }
  }

  async deleteOrphanedAuthUsers(userIds: string[]): Promise<{
    success: boolean;
    message: string;
    deletedCount: number;
    failedCount: number;
    failed: Array<{ userId: string; email: string; error: string }>;
  }> {
    const deleted: string[] = [];
    const failed: Array<{ userId: string; email: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        const email = authUser?.user.email || 'unknown';

        const result = await this.deleteOrphanedAuthUser(userId);

        if (result.success) {
          deleted.push(userId);
        } else {
          failed.push({ userId, email, error: result.message });
        }
      } catch (error: any) {
        failed.push({
          userId,
          email: 'unknown',
          error: error.message || 'Unknown error'
        });
      }
    }

    return {
      success: failed.length === 0,
      message: `Deleted ${deleted.length} orphaned user(s)${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
      deletedCount: deleted.length,
      failedCount: failed.length,
      failed
    };
  }
}

export const userSyncService = new UserSyncService();
