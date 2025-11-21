import { supabase, AppUser } from './supabase';
import { createAuditLog } from './auditService';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'super_admin';
  status: string;
  permissions?: any;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAdminParams {
  email: string;
  full_name: string;
  role?: 'admin';
  permissions?: any;
}

export interface UpdateAdminParams {
  full_name?: string;
  status?: 'active' | 'inactive' | 'suspended';
  permissions?: any;
}

class AdminService {
  async listAdmins(): Promise<{ data: AppUser[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .in('role', ['admin', 'super_admin'])
        .order('full_name');

      return { data, error };
    } catch (error) {
      console.error('Error listing admins:', error);
      return { data: null, error };
    }
  }

  async getAdmin(adminId: string): Promise<{ data: AppUser | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', adminId)
        .in('role', ['admin', 'super_admin'])
        .maybeSingle();

      return { data, error };
    } catch (error) {
      console.error('Error fetching admin:', error);
      return { data: null, error };
    }
  }

  async updateAdmin(
    adminId: string,
    updates: UpdateAdminParams,
    currentUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUserRole = await this.getUserRole(currentUserId);

      if (currentUserRole !== 'super_admin') {
        await createAuditLog({
          userId: currentUserId,
          action: 'UPDATE_DENIED',
          entityType: 'admin',
          entityId: adminId,
          details: { reason: 'Insufficient permissions - only super_admin can update admins' }
        });
        return {
          success: false,
          error: 'Only super administrators can update admin users'
        };
      }

      const { data: existingAdmin } = await this.getAdmin(adminId);
      if (!existingAdmin) {
        return { success: false, error: 'Admin user not found' };
      }

      if (existingAdmin.role === 'super_admin') {
        return {
          success: false,
          error: 'Cannot modify super administrator accounts'
        };
      }

      const { error } = await supabase
        .from('app_users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', adminId);

      if (error) throw error;

      await createAuditLog({
        userId: currentUserId,
        action: 'UPDATE_SUCCESS',
        entityType: 'admin',
        entityId: adminId,
        details: {
          updates,
          admin_email: existingAdmin.email,
          admin_name: existingAdmin.full_name
        }
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error updating admin:', error);
      return {
        success: false,
        error: error.message || 'Failed to update admin user'
      };
    }
  }

  async getAdminStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    superAdmins: number;
    regularAdmins: number;
  }> {
    try {
      const { data } = await this.listAdmins();

      if (!data) {
        return {
          total: 0,
          active: 0,
          inactive: 0,
          superAdmins: 0,
          regularAdmins: 0
        };
      }

      return {
        total: data.length,
        active: data.filter(a => a.status === 'active').length,
        inactive: data.filter(a => a.status !== 'active').length,
        superAdmins: data.filter(a => a.role === 'super_admin').length,
        regularAdmins: data.filter(a => a.role === 'admin').length
      };
    } catch (error) {
      console.error('Error getting admin stats:', error);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        superAdmins: 0,
        regularAdmins: 0
      };
    }
  }

  private async getUserRole(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) {
        console.error('getUserRole error in adminService:', error, 'userId:', userId);
        return null;
      }
      console.log('adminService getUserRole result:', data.role, 'for user:', userId);
      return data.role;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  }

  async canManageAdmins(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === 'super_admin';
  }

  async canDeleteAdmin(userId: string, targetAdminId: string): Promise<{ canDelete: boolean; reason?: string }> {
    const role = await this.getUserRole(userId);

    if (role !== 'super_admin') {
      return {
        canDelete: false,
        reason: 'Only super administrators can delete admin users'
      };
    }

    if (userId === targetAdminId) {
      return {
        canDelete: false,
        reason: 'Cannot delete your own account'
      };
    }

    const { data: targetAdmin } = await this.getAdmin(targetAdminId);
    if (targetAdmin?.role === 'super_admin') {
      return {
        canDelete: false,
        reason: 'Cannot delete super administrator accounts'
      };
    }

    return { canDelete: true };
  }
}

export const adminService = new AdminService();
