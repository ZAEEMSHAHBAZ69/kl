import { useState, useEffect } from 'react';
import { supabase, Partner } from '../lib/supabase';
import { X, Save, AlertCircle } from 'lucide-react';

interface EditPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  partner: Partner | null;
}

export default function EditPartnerModal({ isOpen, onClose, onSuccess, partner }: EditPartnerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    contact_email: '',
    phone: '',
    address: '',
    status: 'active' as 'active' | 'inactive' | 'suspended'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && partner) {
      setFormData({
        name: partner.name || '',
        company_name: partner.company_name || '',
        contact_email: partner.contact_email || '',
        phone: partner.phone || '',
        address: partner.address || '',
        status: partner.status || 'active'
      });
      setError('');
    }
  }, [isOpen, partner]);

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Partner name is required');
      return false;
    }
    
    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (formData.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      setError('Please enter a valid phone number');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !partner) return;

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('partners')
        .update({
          name: formData.name.trim(),
          company_name: formData.company_name.trim() || null,
          contact_email: formData.contact_email.trim() || null,
          phone: formData.phone.trim() || null,
          address: formData.address.trim() || null,
          status: formData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', partner.id);

      if (updateError) {
        console.error('Update error:', updateError);
        setError('Failed to update partner. Please try again.');
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating partner:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#161616] rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Edit Partner</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Partner Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Enter partner name"
              className="w-full bg-[#1E1E1E] text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="Enter company name"
              className="w-full bg-[#1E1E1E] text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contact Email
            </label>
            <input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              placeholder="Enter contact email"
              className="w-full bg-[#1E1E1E] text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Enter phone number"
              className="w-full bg-[#1E1E1E] text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter address"
              rows={3}
              className="w-full bg-[#1E1E1E] text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'suspended' })}
              className="w-full bg-[#1E1E1E] text-gray-400 px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f] hover:text-white transition-colors [&>option]:text-white [&>option:checked]:bg-[#48a77f]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[#1E1E1E] hover:bg-[#2C2C2C] text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center space-x-2 bg-[#48a77f] hover:bg-[#3d9166] text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}