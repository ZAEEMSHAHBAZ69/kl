import { useState, useEffect } from 'react';
import { supabase, MCMParent, UserRole, Invitation } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../components/NotificationContainer';
import { Plus, Users, Building2, Building, Clock, Edit, Trash2, X } from 'lucide-react';
import ApprovalQueue from '../components/ApprovalQueue';
import ConfirmationDialog from '../components/ConfirmationDialog';
import EditMCMParentModal from '../components/EditMCMParentModal';
import UsersSection from '../components/UsersSection';
import CustomSelect from '../components/CustomSelect';
import { deletionService } from '../lib/deletionService';
import { adminService } from '../lib/adminService';
import { inviteUserDirectly } from '../lib/invitations';

export interface User {
  id: string;
  full_name?: string | null;
  name?: string;
  email?: string;
  contact_email?: string;
  company_name?: string;
  phone?: string;
  address?: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at?: string;
  last_login?: string;
}

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AddMCMParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function AddUserModal({ isOpen, onClose, onSuccess }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    full_name: '',
    company_name: '',
    contact_email: '',
    phone: '',
    address: '',
    role: 'partner' as UserRole
  });
  const [loading, setLoading] = useState(false);
  const { appUser } = useAuth();
  const { showSuccess, showError } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const invitationResult = await inviteUserDirectly(
        formData.contact_email,
        formData.role,
        appUser?.id || '',
        {
          full_name: formData.role === 'partner' ? formData.name : formData.full_name || formData.contact_email.split('@')[0],
          company_name: formData.company_name || appUser?.company_name || 'LP Media',
          partner_id: undefined,
          inviter_name: appUser?.full_name || 'Admin',
        }
      );

      if (!invitationResult.success) {
        throw new Error(invitationResult.error || 'Failed to send invitation');
      }

      showSuccess('Invitation Sent', `${formData.role === 'admin' ? 'Admin' : 'Partner'} invitation sent successfully to ${formData.contact_email}!`);

      onClose();

      // Delay to ensure database writes complete, then refresh
      setTimeout(() => {
        onSuccess();
      }, 500);
      setFormData({
        name: '',
        full_name: '',
        company_name: '',
        contact_email: '',
        phone: '',
        address: '',
        role: 'partner'
      });
    } catch (error: any) {
      console.error('Error adding user:', error);
      let errorMessage = '';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'object') {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = String(error);
        }
      } else {
        errorMessage = String(error);
      }

      if (error?.code === '42501' || /row-level security/i.test(errorMessage)) {
        errorMessage = 'Not authorized due to Row Level Security. Please sign in and ensure you have the required role.';
      }

      showError('Failed to Create User', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#161616] rounded-lg p-6 w-full max-w-md border border-[#2C2C2C]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            Add New User
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {(appUser?.role === 'super_admin' || appUser?.role === 'admin') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                User Role *
              </label>
              <CustomSelect
                value={formData.role}
                onChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                options={[
                  { value: 'partner', label: 'Partner' },
                  ...(appUser?.role === 'super_admin' ? [{ value: 'admin', label: 'Admin' }] : []),
                  ...(appUser?.role === 'super_admin' ? [{ value: 'super_admin', label: 'Super Admin' }] : []),
                ]}
              />
              <p className="text-xs text-gray-400 mt-1">
                {formData.role === 'partner'
                  ? 'Partners can manage their own publishers and campaigns'
                  : formData.role === 'admin'
                  ? 'Admins can manage partners (only super admins can create admins)'
                  : 'Super admins have full system access'}
              </p>
            </div>
          )}

          {formData.role === 'partner' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Partner Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
                  placeholder="John Doe"
                />
              </div>

              <div className="bg-[#1E1E1E] p-3 rounded-lg">
                <p className="text-xs text-gray-400">
                  <strong>Note:</strong> A secure magic link will be generated that the invitee can use to set up their account.
                  The link expires in 24 hours and can only be used once.
                </p>
              </div>
            </>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#48a77f] hover:bg-[#3d9166] text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : `Add ${formData.role === 'admin' ? 'Admin' : 'Partner'}`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#1E1E1E] hover:bg-[#2C2C2C] text-white py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddMCMParentModal({ isOpen, onClose, onSuccess }: AddMCMParentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    parent_network_code: '',
    service_account_email: '',
    max_child_accounts: 200
  });
  const [loading, setLoading] = useState(false);
  const { appUser } = useAuth();
  const { showError } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('mcm_parents')
        .insert([{
          ...formData,
          created_by: appUser?.id,
          status: 'active',
          current_child_count: 0
        }]);

      if (error) throw error;

      onSuccess();
      onClose();
      setFormData({
        name: '',
        parent_network_code: '',
        service_account_email: '',
        max_child_accounts: 200
      });
    } catch (error) {
      console.error('Error adding MCM parent:', error);
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = 'Failed to serialize error object';
        }
      } else {
        errorMessage = String(error);
      }
      showError('Failed to Create MCM Parent', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#161616] rounded-lg p-6 w-full max-w-md border border-[#2C2C2C]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Add New MCM Parent</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Parent Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Network Code *
            </label>
            <input
              type="text"
              required
              value={formData.parent_network_code}
              onChange={(e) => setFormData({ ...formData, parent_network_code: e.target.value })}
              className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
              placeholder="e.g., 12345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Service Account Email *
            </label>
            <input
              type="email"
              required
              value={formData.service_account_email}
              onChange={(e) => setFormData({ ...formData, service_account_email: e.target.value })}
              className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
              placeholder="service-account@project.iam.gserviceaccount.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Max Child Accounts
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={formData.max_child_accounts}
              onChange={(e) => setFormData({ ...formData, max_child_accounts: parseInt(e.target.value) || 200 })}
              className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:border-[#48a77f]"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#48a77f] hover:bg-[#3d9166] text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add MCM Parent'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#1E1E1E] hover:bg-[#2C2C2C] text-white py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


export default function ControlCenter() {
  const [activeTab, setActiveTab] = useState<'users' | 'mcm-parents' | 'approvals'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [parents, setParents] = useState<MCMParent[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddMCMParentModal, setShowAddMCMParentModal] = useState(false);
  const [showEditMCMParentModal, setShowEditMCMParentModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteMCMParentDialog, setShowDeleteMCMParentDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedMCMParent, setSelectedMCMParent] = useState<MCMParent | null>(null);
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingInvitation, setIsDeletingInvitation] = useState(false);
  const [showDeleteInvitationDialog, setShowDeleteInvitationDialog] = useState(false);
  const [isDeletingMCMParent, setIsDeletingMCMParent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { appUser } = useAuth();
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (showLoadingState = false) => {
    if (showLoadingState) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Small delay to ensure database consistency after writes
      if (showLoadingState) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const supabaseAdmin = supabase;

      if (appUser?.role === 'admin' || appUser?.role === 'super_admin') {
        const invitationRoles = appUser?.role === 'super_admin' ? ['admin', 'partner'] : ['partner'];

        const [appUsersResponse, parentsResponse, invitationsResponse] = await Promise.all([
          supabaseAdmin.from('app_users').select('id, full_name, email, company_name, phone, role, status, created_at, updated_at, last_login').order('full_name'),
          supabaseAdmin.from('mcm_parents').select('*').order('name'),
          supabaseAdmin.from('invitations').select('*').in('role', invitationRoles).eq('status', 'pending').order('created_at', { ascending: false })
        ]);

        if (appUsersResponse.error) {
          console.error('App users fetch error:', appUsersResponse.error);
          throw appUsersResponse.error;
        }
        if (parentsResponse.error) {
          console.error('MCM Parents fetch error:', parentsResponse.error);
          throw parentsResponse.error;
        }
        if (invitationsResponse.error) {
          console.error('Invitations fetch error:', invitationsResponse.error);
          throw invitationsResponse.error;
        }

        const appUsers = appUsersResponse.data || [];

        const allUsers: User[] = appUsers.map(u => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          company_name: u.company_name,
          phone: u.phone,
          role: u.role,
          status: u.status,
          created_at: u.created_at,
          updated_at: u.updated_at,
          last_login: u.last_login
        }));

        setUsers(allUsers);
        setParents(parentsResponse.data || []);
        setPendingInvitations(invitationsResponse.data || []);

        console.log(`Fetched ${allUsers.length} users and ${invitationsResponse.data?.length || 0} pending invitations`);
        console.log('Current user role:', appUser?.role);
        console.log('Users data:', allUsers);
        console.log('Invitations data:', invitationsResponse.data);

        if (showLoadingState) {
          showSuccess('Refreshed', 'User list updated successfully');
        }
      } else {
        console.warn('Non-admin user attempting to access Control Center');
        setUsers([]);
        setParents([]);
        setPendingInvitations([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      let errorMessage = 'Failed to load data';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        try {
          const errObj = error as any;
          if (errObj.message) errorMessage = errObj.message;
          else if (errObj.hint) errorMessage = errObj.hint;
          else if (errObj.details) errorMessage = errObj.details;
          else errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = 'Failed to parse error details';
        }
      }
      showError('Data Loading Error', `Could not load control center data: ${errorMessage}`);
      setUsers([]);
      setParents([]);
      setPendingInvitations([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || !appUser) return;

    setIsDeleting(true);
    try {
      let result;

      if (selectedUser.role === 'partner') {
        result = await deletionService.deleteUserPermanent(selectedUser.id, appUser.id);
      } else {
        const permissionCheck = await adminService.canDeleteAdmin(appUser.id, selectedUser.id);
        if (!permissionCheck.canDelete) {
          showError('Permission Denied', permissionCheck.reason || 'Cannot delete this admin');
          setShowDeleteDialog(false);
          return;
        }
        result = await deletionService.deleteAdminUserPermanent(selectedUser.id, appUser.id);
      }

      if (result.success) {
        const userName = selectedUser.full_name || selectedUser.name || selectedUser.email;
        const message = result.affectedRecords
          ? `User "${userName}" and ${result.affectedRecords} related records permanently deleted successfully`
          : `User "${userName}" permanently deleted successfully`;

        showSuccess('User Deleted', message);
        await fetchData(true); // Use loading state for refresh
        setShowDeleteDialog(false);
        setSelectedUser(null);
      } else {
        const errorMessage = result.error || 'Unknown error occurred';
        console.error('User deletion failed:', result);
        showError('Failed to Delete User', errorMessage);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      showError('Error Deleting User', errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteInvitation = async () => {
    if (!selectedInvitation || !appUser) return;

    setIsDeletingInvitation(true);
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', selectedInvitation.id);

      if (error) throw error;

      showSuccess('Invitation Cancelled', `Invitation to ${selectedInvitation.email} has been removed`);
      await fetchData(true); // Use loading state for refresh
      setShowDeleteInvitationDialog(false);
      setSelectedInvitation(null);
    } catch (error) {
      console.error('Error deleting invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      showError('Error Cancelling Invitation', errorMessage);
    } finally {
      setIsDeletingInvitation(false);
    }
  };

  const canDeleteUser = (user: User) => {
    // Only super_admin can delete users
    if (appUser?.role !== 'super_admin') return false;

    // Cannot delete super_admin users
    if (user.role === 'super_admin') return false;

    // Cannot delete yourself
    if (user.id === appUser?.id) return false;

    // Super admin can delete admins and partners
    return true;
  };

  const canDeleteInvitation = () => {
    // Both admin and super_admin can cancel invitations
    // Admins can cancel partner invitations they sent
    // Super admins can cancel any invitation
    return appUser?.role === 'admin' || appUser?.role === 'super_admin';
  };

  const handleDeleteMCMParent = async () => {
    if (!selectedMCMParent || !appUser) return;

    setIsDeletingMCMParent(true);
    try {
      const { error } = await supabase
        .from('mcm_parents')
        .delete()
        .eq('id', selectedMCMParent.id);

      if (error) throw error;

      showSuccess('MCM Parent Deleted', `MCM Parent "${selectedMCMParent.name}" has been deleted successfully`);
      await fetchData(true);
      setShowDeleteMCMParentDialog(false);
      setSelectedMCMParent(null);
    } catch (error) {
      console.error('Error deleting MCM parent:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      showError('Error Deleting MCM Parent', errorMessage);
    } finally {
      setIsDeletingMCMParent(false);
    }
  };

  const canEditMCMParent = () => {
    return appUser?.role === 'admin' || appUser?.role === 'super_admin';
  };

  const canDeleteMCMParent = () => {
    return appUser?.role === 'admin' || appUser?.role === 'super_admin';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#48a77f]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen overflow-y-auto">
      <div className="flex-shrink-0">
        <div className="px-6 pt-6 pb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Control Center</h1>
          <p className="text-gray-400">Manage partners, MCM parents, and admin users</p>
        </div>

        {/* Tab Navigation */}
        <div className="px-6">
          <div className="flex space-x-1 bg-[#1E1E1E] p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-[#48a77f] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Users
            </button>
            <button
              onClick={() => setActiveTab('mcm-parents')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'mcm-parents'
                  ? 'bg-[#48a77f] text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-2" />
              MCM Parents
            </button>
            {['admin', 'super_admin'].includes(appUser?.role || '') && (
              <button
                onClick={() => setActiveTab('approvals')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'approvals'
                    ? 'bg-[#48a77f] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                Approvals
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 py-6 gap-6 overflow-hidden">
        {/* Refresh Indicator */}
        {isRefreshing && (
          <div className="bg-[#48a77f]/10 border border-[#48a77f]/30 rounded-lg p-3 flex items-center space-x-3 flex-shrink-0">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#48a77f]"></div>
            <span className="text-[#48a77f] text-sm">Refreshing user list...</span>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="overflow-y-auto flex-1 space-y-6">
            <UsersSection
          users={users}
          pendingInvitations={pendingInvitations}
          currentUserId={appUser?.id}
          currentUserRole={appUser?.role}
          onAddUser={() => setShowAddUserModal(true)}
          onDeleteUser={(user) => {
            setSelectedUser(user);
            setShowDeleteDialog(true);
          }}
          onDeleteInvitation={(invitation) => {
            setSelectedInvitation(invitation);
            setShowDeleteInvitationDialog(true);
          }}
          onCanDeleteUser={canDeleteUser}
          onCanDeleteInvitation={canDeleteInvitation}
          onRefresh={() => fetchData(true)}
          isRefreshing={isRefreshing}
            />
          </div>
        )}

        {/* MCM Parents Tab */}
        {activeTab === 'mcm-parents' && (
          <div className="overflow-y-auto flex-1">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">MCM Parents ({parents.length})</h2>
                <button
                  onClick={() => setShowAddMCMParentModal(true)}
                  className="flex items-center space-x-2 bg-[#48a77f] hover:bg-[#3d9166] text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add MCM Parent</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {parents.length === 0 ? (
                  <div className="col-span-full bg-[#161616] rounded-lg p-12 border border-[#2C2C2C] text-center">
                    <Building className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No MCM parent accounts configured</p>
                    <button
                      onClick={() => setShowAddMCMParentModal(true)}
                      className="mt-4 text-[#48a77f] hover:text-[#3d9166] font-medium"
                    >
                      Add your first MCM parent
                    </button>
                  </div>
                ) : (
                  parents.map((parent) => (
                    <div
                      key={parent.id}
                      className="bg-[#161616] rounded-lg p-6 border border-[#2C2C2C] hover:border-[#48a77f] transition-colors"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="bg-[#48a77f] p-3 rounded-lg">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            parent.status === 'active' ? 'bg-[#48a77f]' : 'bg-[#1E1E1E]'
                          }`}
                        >
                          {parent.status}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2">{parent.name}</h3>
                      <p className="text-gray-400 text-sm mb-4">{parent.parent_network_code}</p>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Child Accounts</span>
                          <span className="text-white font-medium">
                            {parent.current_child_count} / {parent.max_child_accounts}
                          </span>
                        </div>

                        <div className="w-full bg-[#1E1E1E] rounded-full h-2">
                          <div
                            className="bg-[#48a77f] h-2 rounded-full transition-all"
                            style={{
                              width: `${((parent.current_child_count ?? 0) / (parent.max_child_accounts ?? 1)) * 100}%`,
                            }}
                          />
                        </div>

                        <div className="pt-2 border-t border-[#2C2C2C]">
                          <p className="text-xs text-gray-400">Service Account</p>
                          <p className="text-sm text-white truncate">{parent.service_account_email}</p>
                        </div>
                      </div>

                      <div className="flex space-x-2 mt-4 pt-4 border-t border-[#2C2C2C]">
                        <button
                          onClick={() => {
                            if (canEditMCMParent()) {
                              setSelectedMCMParent(parent);
                              setShowEditMCMParentModal(true);
                            }
                          }}
                          disabled={!canEditMCMParent()}
                          className={`flex-1 flex items-center justify-center space-x-1 py-2 px-3 rounded text-sm transition-colors ${
                            canEditMCMParent()
                              ? 'bg-[#48a77f] hover:bg-[#3d8a6a] text-white'
                              : 'bg-[#1E1E1E] text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <Edit className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        {canDeleteMCMParent() && (
                          <button
                            onClick={() => {
                              setSelectedMCMParent(parent);
                              setShowDeleteMCMParentDialog(true);
                            }}
                            className="flex items-center justify-center space-x-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div className="overflow-y-auto flex-1">
            <ApprovalQueue userRole={appUser?.role || ''} />
          </div>
        )}
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onSuccess={() => fetchData(true)}
      />
      <AddMCMParentModal
        isOpen={showAddMCMParentModal}
        onClose={() => setShowAddMCMParentModal(false)}
        onSuccess={fetchData}
      />
      {selectedMCMParent && (
        <EditMCMParentModal
          isOpen={showEditMCMParentModal}
          onClose={() => {
            setShowEditMCMParentModal(false);
            setSelectedMCMParent(null);
          }}
          onSuccess={() => fetchData(true)}
          mcmParent={selectedMCMParent}
        />
      )}

      {/* User Deletion Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setSelectedUser(null);
        }}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete the user "${selectedUser?.full_name || selectedUser?.name || selectedUser?.email}"? This action will permanently remove all associated data including publishers, campaigns, and historical records.`}
        entityType="user"
        entityName={selectedUser?.full_name || selectedUser?.name || selectedUser?.email || ''}
        warningLevel="critical"
        isLoading={isDeleting}
        affectedData={{
          publishers: 0,
          users: 0
        }}
      />

      {/* Invitation Deletion Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteInvitationDialog}
        onClose={() => {
          setShowDeleteInvitationDialog(false);
          setSelectedInvitation(null);
        }}
        onConfirm={handleDeleteInvitation}
        title="Cancel Invitation"
        message={`Are you sure you want to cancel the invitation for "${selectedInvitation?.email}"? The invitation link will no longer be valid.`}
        entityType="invitation"
        entityName={selectedInvitation?.email || ''}
        warningLevel="warning"
        isLoading={isDeletingInvitation}
        affectedData={{}}
      />

      {/* MCM Parent Deletion Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteMCMParentDialog}
        onClose={() => {
          setShowDeleteMCMParentDialog(false);
          setSelectedMCMParent(null);
        }}
        onConfirm={handleDeleteMCMParent}
        title="Delete MCM Parent"
        message={`Are you sure you want to delete "${selectedMCMParent?.name}"? This action will remove the MCM parent configuration. Publishers associated with this parent may need to be reassigned.`}
        entityType="mcm_parent"
        entityName={selectedMCMParent?.name || ''}
        warningLevel="critical"
        isLoading={isDeletingMCMParent}
        affectedData={{
          publishers: selectedMCMParent?.current_child_count || 0
        }}
      />
    </div>
  );
}
