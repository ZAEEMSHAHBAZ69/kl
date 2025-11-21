import { useState, useEffect } from 'react';
import { supabase, MCMParent, Partner } from '../lib/supabase';
import { X, Copy, Check } from 'lucide-react';
import { useNotification } from './NotificationContainer';
import { GAMService } from '../lib/gamService';

interface AddPublisherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userRole: string;
  partnerId: string | null;
}

const SERVICE_ACCOUNT_EMAIL = 'report-api@lp-mediaa.iam.gserviceaccount.com';

export default function AddPublisherModal({
  isOpen,
  onClose,
  onSuccess,
  userRole,
  partnerId,
}: AddPublisherModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    domain: '',
    network_code: '',
    revenue_share: 0,
    parent_mcm_id: '',
    notes: '',
    partner_id: partnerId || '',
  });

  const [parentMCMs, setParentMCMs] = useState<MCMParent[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (isOpen) {
      fetchParentMCMs();
      if (['admin', 'super_admin'].includes(userRole)) {
        fetchPartners();
      }
    }
  }, [isOpen, userRole]);

  const fetchParentMCMs = async () => {
    const { data, error } = await supabase
      .from('mcm_parents')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (error) {
      console.error('Error fetching MCM parents:', error);
      showError('Failed to Load MCM Parents', error.message);
    }

    setParentMCMs(data || []);
  };

  const fetchPartners = async () => {
    const { data, error } = await supabase
      .from('app_users')
      .select('id, full_name, email, company_name, role, status')
      .eq('status', 'active')
      .eq('role', 'partner')
      .order('full_name');

    if (error) {
      console.error('Error fetching partners:', error);
      showError('Failed to Load Partners', error.message);
    }

    setPartners(data || []);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const triggerHistoricalGAMFetch = async (publisherId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.error('No session token available for historical fetch trigger');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/new-pub-report-and-audit`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publisherId }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('Historical GAM report fetch triggered successfully:', result);
      } else {
        console.warn('Historical GAM report fetch returned non-success status:', result);
      }
    } catch (error) {
      console.error('Error triggering historical GAM report fetch:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setVerifying(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const verification = await GAMService.verifyServiceAccountAccess(
        formData.network_code
      );

      if (verification.status === 'invalid') {
        console.error('GAM Verification Failed:', verification);
        console.log('Full verification details:', JSON.stringify(verification, null, 2));

        let errorMessage = 'Authentication failed. Please verify the service account credentials are correct and that the service account email has been added to GAM for the network code you are trying to use.';

        showError('GAM Access Verification Failed', errorMessage);
        setVerifying(false);
        setLoading(false);
        return;
      }

      setVerifying(false);

      const { data: publisherData, error } = await supabase
        .from('publishers')
        .insert([
          {
            name: formData.name,
            domain: formData.domain,
            contact_email: formData.email,
            network_code: formData.network_code,
            revenue_share: formData.revenue_share,
            partner_id: userRole === 'partner' ? partnerId : (formData.partner_id || null),
            mcm_parent_id: formData.parent_mcm_id,
            notes: formData.notes,
            gam_status: 'pending',
            service_key_status: verification.status,
            service_key_verified_at: new Date().toISOString(),
            created_by: user.id,
          },
        ])
        .select();

      if (error) throw error;

      await supabase
        .from('mcm_parents')
        .update({
          current_child_count: supabase.rpc('increment', { x: 1 }),
        })
        .eq('id', formData.parent_mcm_id);

      if (publisherData && publisherData.length > 0) {
        const newPublisherId = publisherData[0].id;
        console.log('Publisher created:', newPublisherId);

        triggerHistoricalGAMFetch(newPublisherId);
      }

      showSuccess('Publisher Created', 'GAM service account access verified successfully. Historical data fetch initiated in background.');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating publisher:', error);
      showError('Failed to Create Publisher', error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161616] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#2C2C2C]">
        <div className="sticky top-0 bg-[#161616] border-b border-[#2C2C2C] p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Add New Publisher</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-black border border-[#2C2C2C] rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">GAM Integration</h3>
            <p className="text-sm text-gray-400 mb-3">
              Share this service account email for GAM delegation
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={SERVICE_ACCOUNT_EMAIL}
                readOnly
                className="flex-1 bg-black text-gray-300 px-3 py-2 rounded border border-[#2C2C2C]"
              />
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-4 py-2 bg-[#48a77f] hover:bg-[#3d9166] text-white rounded transition-colors flex items-center space-x-2"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Account Information</h3>

            {['admin', 'super_admin'].includes(userRole) && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Partner (Optional)
                </label>
                <select
                  value={formData.partner_id}
                  onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                  className="w-full bg-black text-gray-400 px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f] hover:text-white transition-colors [&>option]:text-white [&>option:checked]:bg-[#48a77f]"
                >
                  <option value="">No Partner (Unassigned)</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.full_name || partner.email} {partner.company_name && `(${partner.company_name})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Publisher Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter publisher name"
                className="w-full bg-[#161616] text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Publisher Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="contact@example.com"
                  className="w-full bg-black text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Publisher Domain *
                </label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  required
                  placeholder="example.com"
                  className="w-full bg-black text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Network Code *
                </label>
                <input
                  type="text"
                  value={formData.network_code}
                  onChange={(e) => setFormData({ ...formData, network_code: e.target.value })}
                  required
                  placeholder="12345678"
                  className="w-full bg-black text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Revenue Share (%)
                </label>
                <input
                  type="number"
                  value={formData.revenue_share}
                  onChange={(e) =>
                    setFormData({ ...formData, revenue_share: parseFloat(e.target.value) })
                  }
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  className="w-full bg-black text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Parent GAM *
              </label>
              <select
                value={formData.parent_mcm_id}
                onChange={(e) => setFormData({ ...formData, parent_mcm_id: e.target.value })}
                required
                className="w-full bg-[#161616] text-gray-400 px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f] hover:text-white transition-colors [&>option]:text-white [&>option:checked]:bg-[#48a77f]"
              >
                <option value="">Select Parent GAM</option>
                {parentMCMs.map((mcm) => (
                  <option
                    key={mcm.id}
                    value={mcm.id}
                    disabled={mcm.current_child_count && mcm.max_child_accounts ? mcm.current_child_count >= mcm.max_child_accounts : false}
                  >
                    {mcm.name} ({mcm.parent_network_code}) -{' '}
                    {mcm.current_child_count || 0}/{mcm.max_child_accounts || 0} slots used
                    {mcm.current_child_count && mcm.max_child_accounts && mcm.current_child_count >= mcm.max_child_accounts && ' (FULL)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Any additional notes..."
                className="w-full bg-[#161616] text-white px-4 py-2 rounded border border-[#2C2C2C] focus:outline-none focus:border-[#48a77f]"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-[#2C2C2C]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1E1E1E] hover:bg-[#1E1E1E] text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#48a77f] hover:bg-[#3d9166] text-white rounded transition-colors disabled:opacity-50"
            >
              {verifying ? 'Verifying GAM Access...' : loading ? 'Creating...' : 'Create Publisher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
