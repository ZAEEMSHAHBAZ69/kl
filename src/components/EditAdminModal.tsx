import { useState, useEffect } from 'react';
import { AppUser } from '../lib/supabase';
import { adminService } from '../lib/adminService';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from './NotificationContainer';

interface EditAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  admin: AppUser | null;
}

export default function EditAdminModal({ isOpen, onClose, onSuccess, admin }: EditAdminModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    status: 'active' as 'active' | 'inactive' | 'suspended'
  });
  const [loading, setLoading] = useState(false);
  const { appUser } = useAuth();
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (admin) {
      setFormData({
        full_name: admin.full_name || '',
        email: admin.email || '',
        phone: admin.phone || '',
        status: admin.status || 'active'
      });
    }
  }, [admin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !appUser) return;

    if (appUser.role !== 'super_admin') {
      showError('Permission Denied', 'Only super administrators can edit admin users');
      return;
    }

    if (admin.role === 'super_admin') {
      showError('Permission Denied', 'Cannot modify super administrator accounts');
      return;
    }

    setLoading(true);

    try {
      const result = await adminService.updateAdmin(
        admin.id,
        {
          full_name: formData.full_name,
          status: formData.status
        },
        appUser.id
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update admin');
      }

      showSuccess('Admin Updated', `Admin "${formData.full_name}" updated successfully`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating admin:', error);
      showError('Failed to Update Admin', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !admin) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#161616] rounded-lg p-6 w-full max-w-md border border-[#2C2C2C]">
        <h2 className="text-xl font-bold text-white mb-4">Edit Admin User</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email (Read-only)
            </label>
            <input
              type="email"
              disabled
              value={formData.email}
              className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-gray-400 cursor-not-allowed"
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
              Status *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'suspended' })}
              className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-gray-400 focus:outline-none focus:border-[#48a77f] hover:text-white transition-colors [&>option]:text-white [&>option:checked]:bg-[#48a77f]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#48a77f] hover:bg-[#3d9166] text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Admin'}
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
