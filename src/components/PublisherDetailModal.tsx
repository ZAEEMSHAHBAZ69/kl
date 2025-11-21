import { Publisher, supabase } from '../lib/supabase'
import { X, CheckCircle, XCircle, Trash2, CreditCard as Edit2, Check, RefreshCw, Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
import ConfirmationDialog from './ConfirmationDialog'
import { deletionService } from '../lib/deletionService'
import { useNotification } from './NotificationContainer'
import { useAuth } from '../contexts/AuthContext'
import CustomSelect from './CustomSelect'
import { GAMService } from '../lib/gamService'
import { auditBatchService } from '../lib/auditBatchService'

interface PublisherDetailModalProps {
  publisher: Publisher & { partners?: any; mcm_parents?: any }
  onClose: () => void
  onStatusChange: (publisherId: string, newStatus: string) => void
  onPublisherDeleted?: () => void
  onPublisherUpdated?: () => void
  userRole: string
}

export default function PublisherDetailModal({
  publisher,
  onClose,
  onStatusChange,
  onPublisherDeleted,
  onPublisherUpdated,
  userRole,
}: PublisherDetailModalProps) {
  const { user } = useAuth()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(publisher.name)
  const [isSavingName, setIsSavingName] = useState(false)
  const [isEditingNetworkCode, setIsEditingNetworkCode] = useState(false)
  const [editedNetworkCode, setEditedNetworkCode] = useState(publisher.network_code || '')
  const [isSavingNetworkCode, setIsSavingNetworkCode] = useState(false)
  const [partners, setPartners] = useState<Array<{ id: string; name: string }>>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(publisher.partner_id)
  const [isUpdatingPartner, setIsUpdatingPartner] = useState(false)
  const [isRefreshingServiceKey, setIsRefreshingServiceKey] = useState(false)
  const [isAuditingAll, setIsAuditingAll] = useState(false)
  const { showSuccess, showError } = useNotification()

  const canChangeStatus = ['admin', 'super_admin'].includes(userRole) ||
    (userRole === 'partner' && ['pending', 'approved', 'invited'].includes(publisher.gam_status || ''));

  const canDelete = ['admin', 'super_admin'].includes(userRole) ||
    (userRole === 'partner' && publisher.partner_id);

  const canEditPartner = ['admin', 'super_admin'].includes(userRole);

  useEffect(() => {
    if (canEditPartner) {
      fetchPartners();
    }
  }, [canEditPartner]);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, name, full_name, company_name')
        .eq('role', 'partner')
        .order('full_name');

      if (error) throw error;

      const partnersWithNames = (data || []).map(p => ({
        id: p.id,
        name: p.full_name || p.name || p.company_name || 'Unknown'
      }));

      setPartners(partnersWithNames);
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const handlePartnerChange = async (newPartnerId: string | null) => {
    if (newPartnerId === selectedPartnerId) return;

    setIsUpdatingPartner(true);
    try {
      const { error } = await supabase
        .from('publishers')
        .update({ partner_id: newPartnerId })
        .eq('id', publisher.id);

      if (error) throw error;

      setSelectedPartnerId(newPartnerId);

      const partnerName = newPartnerId
        ? partners.find(p => p.id === newPartnerId)?.name || 'Unknown'
        : 'N/A';

      showSuccess('Partner Updated', `Publisher partner changed to ${partnerName}`);
      onPublisherUpdated?.();
    } catch (error) {
      console.error('Error updating partner:', error);
      showError('Failed to Update Partner', error instanceof Error ? error.message : 'An unexpected error occurred');
      setSelectedPartnerId(selectedPartnerId);
    } finally {
      setIsUpdatingPartner(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.id) {
      showError('Authentication Error', 'You must be logged in to delete publishers')
      return
    }

    setIsDeleting(true)
    try {
      const result = await deletionService.deletePublisher(publisher.id, user.id)

      if (result.success) {
        showSuccess('Publisher Deleted', 'Publisher and related data deleted successfully')
        setShowDeleteDialog(false)
        onPublisherDeleted?.()
        onClose()
      } else {
        showError('Failed to Delete Publisher', result.error || 'Unknown error occurred')
      }
    } catch (error) {
      console.error('Delete error:', error)
      showError('Error Deleting Publisher', error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      showError('Validation Error', 'Publisher name cannot be empty')
      return
    }

    if (editedName === publisher.name) {
      setIsEditingName(false)
      return
    }

    setIsSavingName(true)
    try {
      const { error } = await supabase
        .from('publishers')
        .update({ name: editedName.trim() })
        .eq('id', publisher.id)

      if (error) throw error

      showSuccess('Name Updated', 'Publisher name updated successfully')
      publisher.name = editedName.trim()
      setIsEditingName(false)
    } catch (error) {
      console.error('Error updating name:', error)
      showError('Failed to Update Name', error instanceof Error ? error.message : 'An unexpected error occurred')
      setEditedName(publisher.name)
    } finally {
      setIsSavingName(false)
    }
  }

  const handleCancelEdit = () => {
    setEditedName(publisher.name)
    setIsEditingName(false)
  }

  const handleSaveNetworkCode = async () => {
    if (!editedNetworkCode.trim()) {
      showError('Validation Error', 'Network code cannot be empty')
      return
    }

    if (editedNetworkCode === publisher.network_code) {
      setIsEditingNetworkCode(false)
      return
    }

    setIsSavingNetworkCode(true)
    try {
      const verification = await GAMService.verifyServiceAccountAccess(
        editedNetworkCode.trim()
      )

      if (verification.status === 'invalid') {
        showError(
          'GAM Access Verification Failed',
          `The service account does not have permission to access this GAM network. Please ensure the service email is added as an Admin or Reports user. Error: ${verification.error}`
        )
        setEditedNetworkCode(publisher.network_code || '')
        setIsSavingNetworkCode(false)
        setIsEditingNetworkCode(false)
        return
      }

      const { error } = await supabase
        .from('publishers')
        .update({
          network_code: editedNetworkCode.trim(),
          service_key_status: verification.status,
          service_key_verified_at: new Date().toISOString()
        })
        .eq('id', publisher.id)

      if (error) throw error

      showSuccess('Network Code Updated', 'Network code updated and GAM access verified successfully')
      publisher.network_code = editedNetworkCode.trim()
      setIsEditingNetworkCode(false)
      onPublisherUpdated?.()
    } catch (error) {
      console.error('Error updating network code:', error)
      showError('Failed to Update Network Code', error instanceof Error ? error.message : 'An unexpected error occurred')
      setEditedNetworkCode(publisher.network_code || '')
    } finally {
      setIsSavingNetworkCode(false)
    }
  }

  const handleCancelNetworkCodeEdit = () => {
    setEditedNetworkCode(publisher.network_code || '')
    setIsEditingNetworkCode(false)
  }

  const handleRefreshServiceKeyStatus = async () => {
    if (!publisher.network_code) {
      showError('Network Code Required', 'Publisher must have a network code to check service key status')
      return
    }

    setIsRefreshingServiceKey(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const response = await fetch(
        `${supabaseUrl}/functions/v1/check-service-key-status?publisherId=${publisher.id}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const result = await response.json()

      if (result.success) {
        publisher.service_key_status = result.status
        publisher.service_key_last_check = result.checkedAt

        if (result.status === 'active') {
          showSuccess('Service Key Verified', 'Service account has active access to GAM network')
        } else {
          showError('Service Key Invalid', result.error || 'Service account does not have access')
        }

        onPublisherUpdated?.()
      } else {
        showError('Check Failed', result.error || 'Failed to check service key status')
      }
    } catch (error) {
      console.error('Error refreshing service key status:', error)
      showError('Refresh Failed', error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsRefreshingServiceKey(false)
    }
  }

  const handleQuickAuditAll = async () => {
    if (!user?.id) {
      showError('Authentication Error', 'You must be logged in to start an audit')
      return
    }

    setIsAuditingAll(true)
    try {
      const sites = await auditBatchService.fetchPublisherSiteNames(publisher.id)
      if (sites.length === 0) {
        showError('No Sites', 'No sites found for this publisher to audit')
        setIsAuditingAll(false)
        return
      }

      const siteNames = sites.map((s) => s.site_name)
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData?.session
      if (!session) {
        showError('Authentication Error', 'Session not available')
        setIsAuditingAll(false)
        return
      }

      const result = await auditBatchService.initiateMultiSiteAudit(
        publisher.id,
        siteNames,
        session.access_token
      )

      if (result.success) {
        showSuccess('Audit Started', `Monitoring initiated for ${siteNames.length} site${siteNames.length !== 1 ? 's' : ''}`)
        onPublisherUpdated?.()
      } else {
        showError('Audit Failed', result.error || 'Failed to initiate audit')
      }
    } catch (error) {
      console.error('Error initiating quick audit:', error)
      showError('Error', error instanceof Error ? error.message : 'Failed to start audit')
    } finally {
      setIsAuditingAll(false)
    }
  }


  const getAvailableTransitions = () => {
    if (['admin', 'super_admin'].includes(userRole)) {
      return [
        { value: 'pending', label: 'Pending' },
        { value: 'accepted', label: 'Accepted' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'approved', label: 'Approved' },
        { value: 'invited', label: 'Invited' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'withdrawn', label: 'Withdrawn' },
        { value: 'policy_issues', label: 'Policy Issues' },
        { value: 'ivt_issues', label: 'IVT Issues' },
        { value: 'not_approved', label: 'Not Approved' },
      ];
    }

    if (userRole === 'partner') {
      const currentStatus = publisher.gam_status;

      if (currentStatus === 'pending') {
        return [];
      }

      if (currentStatus === 'approved' || ['invited', 'rejected', 'withdrawn', 'policy_issues', 'ivt_issues', 'not_approved'].includes(currentStatus || '')) {
        return [
          { value: 'pending', label: 'Pending' },
          { value: 'accepted', label: 'Accepted' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'policy_issues', label: 'Policy Issues' },
          { value: 'ivt_issues', label: 'IVT Issues' },
          { value: 'not_approved', label: 'Not Approved' },
        ];
      }
    }

    return [];
  };

  const handleStatusChangeClick = (newStatus: string) => {
    onStatusChange(publisher.id, newStatus);
  };

  const availableTransitions = getAvailableTransitions();

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161616] rounded-[10px] w-full max-w-4xl border border-[#2C2C2C] shadow-2xl max-h-[90vh] flex flex-col">
        <div className="sticky top-0 z-10 bg-[#161616] border-b border-[#2C2C2C] p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Publisher Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-[#0E0E0E] rounded-[10px] p-6 border border-[#2C2C2C]">
            <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-400 mb-1">Name</dt>
                <dd className="text-white font-medium">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="px-3 py-1.5 bg-[#1E1E1E] border border-[#2C2C2C] rounded text-white focus:outline-none focus:border-[#48a77f] flex-1"
                        disabled={isSavingName}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={isSavingName}
                        className="p-1.5 bg-[#48a77f] hover:bg-[#3d9166] text-white rounded transition-colors disabled:opacity-50"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSavingName}
                        className="p-1.5 bg-[#1E1E1E] hover:bg-[#2C2C2C] text-white rounded transition-colors disabled:opacity-50"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{publisher.name}</span>
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="p-1 hover:bg-[#1E1E1E] rounded transition-colors text-gray-400 hover:text-[#48a77f]"
                        title="Edit name"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-400 mb-1">Domain</dt>
                <dd className="text-white font-medium">{publisher.domain}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-400 mb-1">Contact Email</dt>
                <dd className="text-white font-medium">{publisher.contact_email || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-400 mb-1">Network Code</dt>
                <dd className="text-white font-medium">
                  {isEditingNetworkCode ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedNetworkCode}
                        onChange={(e) => setEditedNetworkCode(e.target.value)}
                        className="px-3 py-1.5 bg-[#1E1E1E] border border-[#2C2C2C] rounded text-white focus:outline-none focus:border-[#48a77f] flex-1"
                        disabled={isSavingNetworkCode}
                        autoFocus
                        placeholder="Enter network code"
                      />
                      <button
                        onClick={handleSaveNetworkCode}
                        disabled={isSavingNetworkCode}
                        className="p-1.5 bg-[#48a77f] hover:bg-[#3d9166] text-white rounded transition-colors disabled:opacity-50"
                        title="Save and verify"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelNetworkCodeEdit}
                        disabled={isSavingNetworkCode}
                        className="p-1.5 bg-[#1E1E1E] hover:bg-[#2C2C2C] text-white rounded transition-colors disabled:opacity-50"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{publisher.network_code || 'N/A'}</span>
                      {canEditPartner && (
                        <button
                          onClick={() => setIsEditingNetworkCode(true)}
                          className="p-1 hover:bg-[#1E1E1E] rounded transition-colors text-gray-400 hover:text-[#48a77f]"
                          title="Edit network code"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </dd>
              </div>
              {userRole !== 'partner' && (
                <div>
                  <dt className="text-sm text-gray-400 mb-1">Partner</dt>
                  <dd className="text-white font-medium">
                    {canEditPartner ? (
                      <CustomSelect
                        value={selectedPartnerId || ''}
                        onChange={(value) => handlePartnerChange(value || null)}
                        disabled={isUpdatingPartner}
                        options={[
                          { value: '', label: 'N/A' },
                          ...partners.map((partner) => ({
                            value: partner.id,
                            label: partner.name,
                          })),
                        ]}
                      />
                    ) : (
                      <span>{publisher.partner?.full_name || publisher.partner?.company_name || 'N/A'}</span>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-400 mb-1">Parent MCM</dt>
                <dd className="text-white font-medium">
                  {publisher.mcm_parents?.name
                    ? `${publisher.mcm_parents.name} (${publisher.mcm_parents.parent_network_code || 'N/A'})`
                    : 'Not Assigned'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-[#0E0E0E] rounded-[10px] p-6 border border-[#2C2C2C]">
            <h3 className="text-lg font-semibold text-white mb-4">Status Information</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-400 mb-1">GAM Status</dt>
                <dd>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      publisher.gam_status === 'accepted' || publisher.gam_status === 'approved' || publisher.gam_status === 'invited'
                        ? 'bg-[#48a77f]'
                        : publisher.gam_status === 'pending'
                        ? 'bg-[#48a77f]'
                        : publisher.gam_status === 'rejected'
                        ? 'bg-red-600'
                        : publisher.gam_status === 'withdrawn'
                        ? 'bg-yellow-600'
                        : publisher.gam_status === 'policy_issues'
                        ? 'bg-orange-600'
                        : publisher.gam_status === 'ivt_issues'
                        ? 'bg-purple-600'
                        : 'bg-[#1E1E1E]'
                    }`}
                  >
                    {publisher.gam_status}
                  </span>
                </dd>
              </div>
              {publisher.admin_approved !== null && (
                <div>
                  <dt className="text-sm text-gray-400 mb-1">Admin Approved</dt>
                  <dd className="flex items-center space-x-2">
                    {publisher.admin_approved ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-[#48a77f]" />
                        <span className="text-white">Yes</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-500" />
                        <span className="text-white">No</span>
                      </>
                    )}
                  </dd>
                </div>
              )}
              {publisher.approved_at && (
                <div>
                  <dt className="text-sm text-gray-400 mb-1">Approved At</dt>
                  <dd className="text-white">
                    {new Date(publisher.approved_at).toLocaleString()}
                  </dd>
                </div>
              )}
              {publisher.approval_notes && (
                <div className="col-span-2">
                  <dt className="text-sm text-gray-400 mb-1">Approval Notes</dt>
                  <dd className="text-white bg-[#1E1E1E] p-3 rounded border">
                    {publisher.approval_notes}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-400 mb-1">Service Key Status</dt>
                <dd className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      publisher.service_key_status === 'active'
                        ? 'bg-[#48a77f] text-white'
                        : publisher.service_key_status === 'invalid'
                        ? 'bg-red-600 text-white'
                        : 'bg-[#1E1E1E] text-gray-400'
                    }`}
                  >
                    {publisher.service_key_status}
                  </span>
                  <button
                    onClick={handleRefreshServiceKeyStatus}
                    disabled={isRefreshingServiceKey || !publisher.network_code}
                    className="p-1.5 hover:bg-[#1E1E1E] rounded transition-colors text-gray-400 hover:text-[#48a77f] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh service key status"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshingServiceKey ? 'animate-spin' : ''}`} />
                  </button>
                </dd>
              </div>
              {publisher.service_key_last_check && (
                <div>
                  <dt className="text-sm text-gray-400 mb-1">Last Service Key Check</dt>
                  <dd className="text-white">
                    {new Date(publisher.service_key_last_check).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-[#0E0E0E] rounded-[10px] p-6 border border-[#2C2C2C]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">MFA Compliance Score</h3>
              {['admin', 'super_admin'].includes(userRole) && (
                <button
                  onClick={handleQuickAuditAll}
                  disabled={isAuditingAll}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Trigger monitoring worker for all sites"
                >
                  {isAuditingAll ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Auditing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Audit Now</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <dt className="text-sm text-gray-400 mb-1">Overall MFA Score</dt>
                <dd className="text-3xl font-bold text-[#48a77f]">
                  {publisher.mfa_score ?? 'N/A'}
                </dd>
              </div>
            </dl>
            <p className="text-sm text-gray-400">MFA scores are calculated from site audits and compliance data. Use "Audit Now" to audit multiple sites.</p>
          </div>

          <div className="bg-[#0E0E0E] rounded-[10px] p-6 border border-[#2C2C2C]">
            <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-400 mb-1">Last Revenue</dt>
                <dd className="text-white font-medium">
                  ${publisher.last_revenue?.toFixed(2) || '0.00'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-400 mb-1">Last eCPM</dt>
                <dd className="text-white font-medium">
                  ${publisher.last_ecpm?.toFixed(2) || '0.00'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-400 mb-1">Last CTR</dt>
                <dd className="text-white font-medium">
                  {publisher.last_ctr?.toFixed(2) || '0.00'}%
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-400 mb-1">Last Fill Rate</dt>
                <dd className="text-white font-medium">
                  {publisher.last_fill_rate?.toFixed(2) || '0.00'}%
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm text-gray-400 mb-1">Metrics Updated At</dt>
                <dd className="text-white">
                  {publisher.metrics_updated_at
                    ? new Date(publisher.metrics_updated_at).toLocaleString()
                    : 'Never'}
                </dd>
              </div>
            </dl>
          </div>

          {canChangeStatus && availableTransitions.length > 0 && (
            <div className="bg-[#0E0E0E] rounded-[10px] p-6 border border-[#2C2C2C]">
              <h3 className="text-lg font-semibold text-white mb-4">Change Status</h3>
              
              <div className="flex flex-wrap gap-2">
                {availableTransitions
                  .filter((t) => t.value !== publisher.gam_status)
                  .map((transition) => (
                    <button
                      key={transition.value}
                      onClick={() => handleStatusChangeClick(transition.value)}
                      className={`px-4 py-2 rounded-[10px] font-medium transition-colors ${
                        transition.value === 'approved'
                          ? 'bg-[#48A77F] hover:bg-[#5BBF94] text-white'
                          : transition.value === 'rejected'
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : transition.value === 'suspended'
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          : 'bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white'
                      }`}
                    >
                      {transition.label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Delete Section */}
          {canDelete && (
            <div className="bg-red-900/20 rounded-[10px] p-6 border border-red-800">
              <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Danger Zone
              </h3>
              <p className="text-red-300 text-sm mb-4">
                Permanently delete this publisher and all associated data. This action cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-[10px] font-medium transition-colors flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Publisher
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-[#2C2C2C] p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white rounded-[10px] transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Publisher"
        message={`Are you sure you want to permanently delete "${publisher.name}"? This will remove all associated data including performance reports, alerts, and MFA scans.`}
        entityType="publisher"
        entityName={publisher.name}
        warningLevel="critical"
        affectedData={{
          reports: 0, // TODO: Get actual counts
          alerts: 0,
        }}
        isLoading={isDeleting}
      />
    </div>
  );
}
