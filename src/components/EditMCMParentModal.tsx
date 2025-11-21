import { useState, useEffect } from 'react';
import { MCMParent, supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from './NotificationContainer';

interface EditMCMParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mcmParent: MCMParent | null;
}

export default function EditMCMParentModal({ isOpen, onClose, onSuccess, mcmParent }: EditMCMParentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    parent_network_code: '',
    service_account_email: '',
    max_child_accounts: 200,
    status: 'active' as 'active' | 'inactive'
  });
  const [loading, setLoading] = useState(false);
  const { appUser } = useAuth();
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (mcmParent) {
      setFormData({
        name: mcmParent.name || '',
        parent_network_code: mcmParent.parent_network_code || '',
        service_account_email: mcmParent.service_account_email || '',
        max_child_accounts: mcmParent.max_child_accounts || 200,
        status: mcmParent.status || 'active'
      });
    }
  }, [mcmParent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcmParent || !appUser) return;

    if (appUser.role !== 'super_admin' && appUser.role !== 'admin') {
      showError('Permission Denied', 'Only administrators can edit MCM parents');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('mcm_parents')
        .update({
          name: formData.name,
          parent_network_code: formData.parent_network_code,
          service_account_email: formData.service_account_email,
          max_child_accounts: formData.max_child_accounts,
          status: formData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', mcmParent.id);

      if (error) throw error;

      showSuccess('MCM Parent Updated', `MCM Parent "${formData.name}" updated successfully`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating MCM parent:', error);
      const errorMessage = error?.message || 'Failed to update MCM parent';
      showError('Failed to Update MCM Parent', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mcmParent) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#161616] rounded-lg p-6 w-full max-w-md border border-[#2C2C2C]">
        <h2 className="text-xl font-bold text-white mb-4">Edit MCM Parent</h2>

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

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Status *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
              className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-gray-400 focus:outline-none focus:border-[#48a77f] hover:text-white transition-colors [&>option]:text-white [&>option:checked]:bg-[#48a77f]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#48a77f] hover:bg-[#3d9166] text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update MCM Parent'}
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
