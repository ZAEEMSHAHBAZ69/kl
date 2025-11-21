import { useState, useEffect } from 'react';
import { supabase, Publisher, ApprovalLog } from '../lib/supabase';
import { CheckCircle, XCircle, Clock, FileText, MoreVertical, Globe, ExternalLink, ChevronUp, ChevronDown, History } from 'lucide-react';
import { useNotification } from './NotificationContainer';

interface ApprovalQueueProps {
  userRole: string;
}

// Extended types for joined data
interface PublisherWithRelations extends Publisher {
  partner?: {
    id: string;
    full_name: string | null;
    company_name: string | null;
  };
  mcm_parents?: {
    name: string;
    parent_network_code: string;
  };
}

interface ApprovalLogWithRelations extends ApprovalLog {
  publishers?: {
    name: string;
    domain: string;
  };
  app_users?: {
    email: string;
  };
}

export default function ApprovalQueue({ userRole }: ApprovalQueueProps) {
  const [pendingPublishers, setPendingPublishers] = useState<PublisherWithRelations[]>([]);
  const [approvalLogs, setApprovalLogs] = useState<ApprovalLogWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPublisher, setSelectedPublisher] = useState<PublisherWithRelations | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | 'invited' | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'activity'>('pending');
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (['admin', 'super_admin'].includes(userRole)) {
      fetchPendingPublishers();
      fetchApprovalLogs();
    }
  }, [userRole]);

  const fetchPendingPublishers = async () => {
    try {
      const { data, error } = await supabase
        .from('publishers')
        .select(`
          *,
          partner:app_users!partner_id (id, full_name, company_name),
          mcm_parents (name, parent_network_code)
        `)
        .eq('gam_status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPendingPublishers(data || []);
    } catch (error) {
      console.error('Error fetching pending publishers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovalLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('approval_logs')
        .select(`
          *,
          publishers (name, domain),
          app_users (email)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setApprovalLogs(data || []);
    } catch (error) {
      console.error('Error fetching approval logs:', error);
    }
  };

  const handleApprovalAction = (publisher: PublisherWithRelations, action: 'approve' | 'reject' | 'invited') => {
    setSelectedPublisher(publisher);
    setPendingAction(action);
    setShowApprovalModal(true);
  };

  const confirmApprovalAction = async () => {
    if (!selectedPublisher || !pendingAction) return;

    try {
      let newStatus: string;
      switch (pendingAction) {
        case 'approve':
          newStatus = 'approved';
          break;
        case 'reject':
          newStatus = 'not_approved';
          break;
        case 'invited':
          newStatus = 'invited';
          break;
        default:
          throw new Error('Invalid action');
      }

      const { data, error } = await supabase.rpc('update_publisher_status', {
        publisher_id: selectedPublisher.id,
        new_status: newStatus,
        approval_notes: '',
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to update status');
      }

      // Refresh data
      fetchPendingPublishers();
      fetchApprovalLogs();

      // Reset modal state
      setShowApprovalModal(false);
      setSelectedPublisher(null);
      setPendingAction(null);

      const actionText = pendingAction === 'approve' ? 'approved' : pendingAction === 'reject' ? 'rejected' : 'set to invited';
      showSuccess('Status Updated', `Publisher ${actionText} successfully`);
    } catch (error: any) {
      showError('Error Processing Approval', error.message || 'An unexpected error occurred');
    }
  };

  const cancelApprovalAction = () => {
    setShowApprovalModal(false);
    setSelectedPublisher(null);
    setPendingAction(null);
  };

  if (!['admin', 'super_admin'].includes(userRole)) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#48a77f]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="px-6 py-8 flex-shrink-0">
        {/* Tab Navigation */}
        <div className="flex gap-2 bg-[#1E1E1E] p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-[#48a77f] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Approvals</span>
            {pendingPublishers.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'pending' ? 'bg-white/20' : 'bg-yellow-600'
              }`}>
                {pendingPublishers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'activity'
                ? 'bg-[#48a77f] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Recent Activity</span>
            {approvalLogs.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'activity' ? 'bg-white/20' : 'bg-blue-600'
              }`}>
                {approvalLogs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Pending Approvals Tab */}
      {activeTab === 'pending' && (
        <div className="mt-6 mx-6 bg-[#161616] rounded-lg border border-[#2C2C2C] shadow-lg flex flex-col flex-1 min-h-[75vh] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2C2C2C] flex-shrink-0">
            <h2 className="text-lg font-semibold text-white">Pending Approvals Queue</h2>
          </div>

          {pendingPublishers.length === 0 ? (
            <div className="text-center py-12 px-6 flex items-center justify-center flex-1">
              <div>
                <CheckCircle className="w-12 h-12 text-[#48a77f] mx-auto mb-4" />
                <p className="text-gray-400">No publishers pending approval</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#0E0E0E] border-b border-[#2C2C2C] sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide min-w-[180px]">
                      Publisher Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide min-w-[140px]">
                      Network Code
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide min-w-[160px]">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide min-w-[160px]">
                      Site
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wide min-w-[140px]">
                      Partner
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wide min-w-[100px]">
                      MFA Score
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wide min-w-[80px] sticky right-0 bg-[#0E0E0E]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C2C2C]">
                  {pendingPublishers.map((publisher) => (
                    <tr key={publisher.id} className="hover:bg-[#1E1E1E] transition-colors duration-150 border-b border-[#2C2C2C]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#48a77f]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Globe className="w-4 h-4 text-[#48a77f]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-white truncate text-sm">{publisher.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {publisher.network_code ? (
                          <a
                            href={`https://admanager.google.com/${publisher.network_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[#48a77f] hover:text-[#3d9166] transition-colors text-sm"
                          >
                            <span className="truncate">{publisher.network_code}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300 truncate block text-sm">{publisher.contact_email || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={`https://${publisher.domain.replace(/^https?:\/\//, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[#48a77f] hover:text-[#3d9166] transition-colors text-sm"
                        >
                          <span className="truncate">{publisher.domain}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300 truncate block text-sm">{publisher.partner?.full_name || publisher.partner?.company_name || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-white font-semibold text-sm">{publisher.mfa_score || 0}</span>
                      </td>
                      <td className="px-6 py-4 text-center relative sticky right-0 bg-[#161616] border-l border-[#2C2C2C]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuOpen(actionMenuOpen === publisher.id ? null : publisher.id);
                          }}
                          className="p-2 hover:bg-[#2C2C2C] rounded-md transition-colors duration-150 inline-flex items-center justify-center"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-400" />
                        </button>

                        {actionMenuOpen === publisher.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setActionMenuOpen(null)}
                            />
                            <div className="absolute right-0 mt-1 w-48 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg shadow-xl z-50">
                              <div className="p-1.5 space-y-0.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprovalAction(publisher, 'approve');
                                    setActionMenuOpen(null);
                                  }}
                                  className="w-full px-3 py-2.5 text-left text-[#48a77f] hover:bg-[#2C2C2C] rounded-md flex items-center gap-2 transition-colors"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="font-medium text-sm">Approve</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprovalAction(publisher, 'reject');
                                    setActionMenuOpen(null);
                                  }}
                                  className="w-full px-3 py-2.5 text-left text-red-400 hover:bg-[#2C2C2C] rounded-md flex items-center gap-2 transition-colors"
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span className="font-medium text-sm">Reject</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprovalAction(publisher, 'invited');
                                    setActionMenuOpen(null);
                                  }}
                                  className="w-full px-3 py-2.5 text-left text-blue-400 hover:bg-[#2C2C2C] rounded-md flex items-center gap-2 transition-colors"
                                >
                                  <Clock className="w-4 h-4" />
                                  <span className="font-medium text-sm">Set as Invited</span>
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="overflow-x-auto approval-queue-scroll border-t border-[#2C2C2C]"></div>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity Tab */}
      {activeTab === 'activity' && (
        <div className="mt-6 mx-6 bg-[#161616] rounded-lg border border-[#2C2C2C] shadow-lg flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2C2C2C] flex-shrink-0">
            <h2 className="text-lg font-semibold text-white">Recent Approval Activity</h2>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-8">
            {approvalLogs.length === 0 ? (
              <div className="text-center py-12 flex items-center justify-center h-full">
                <p className="text-gray-400">No approval activity yet</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 pb-4">
                  {(showAllLogs ? approvalLogs : approvalLogs.slice(0, 3)).map((log) => (
                    <div key={log.id} className="bg-[#0A0A0A] rounded-lg p-4 border border-[#2C2C2C] hover:border-[#48a77f]/50 transition-colors">
                      <div className="flex items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${
                            log.action === 'status_changed' && log.new_status === 'approved'
                              ? 'bg-[#48a77f]'
                              : log.action === 'status_changed' && log.new_status === 'not_approved'
                              ? 'bg-red-500'
                              : log.action === 'status_changed' && log.new_status === 'invited'
                              ? 'bg-blue-500'
                              : 'bg-gray-500'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-sm">
                              <span className="font-medium">{log.publishers?.name}</span>
                              <span className="text-gray-400"> status changed from </span>
                              <span className="font-medium">{log.old_status}</span>
                              <span className="text-gray-400"> to </span>
                              <span className="font-medium">{log.new_status}</span>
                            </p>
                            {log.notes && (
                              <p className="text-gray-400 text-sm mt-1">{log.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-400 flex-shrink-0">
                          <p className="truncate max-w-[150px]">{log.app_users?.email}</p>
                          <p className="whitespace-nowrap text-xs mt-1">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {approvalLogs.length > 3 && (
                  <div className="pt-4 border-t border-[#2C2C2C]">
                    <button
                      onClick={() => setShowAllLogs(!showAllLogs)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#1E1E1E] hover:bg-[#2C2C2C] text-gray-300 rounded-lg text-sm transition-colors"
                    >
                      {showAllLogs ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Show All {approvalLogs.length} Activities
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedPublisher && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161616] rounded-lg w-full max-w-md border border-[#2C2C2C]">
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                {pendingAction === 'approve' ? 'Approve' : pendingAction === 'reject' ? 'Reject' : 'Set as Invited'} Publisher
              </h3>
              
              <div className="mb-4">
                <p className="text-gray-300 mb-2">
                  <strong>{selectedPublisher.name}</strong> ({selectedPublisher.domain})
                </p>
                <p className="text-sm text-gray-400">
                  Partner: {selectedPublisher.partner?.full_name || 'N/A'}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={confirmApprovalAction}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors text-white ${
                    pendingAction === 'approve'
                      ? 'bg-[#48a77f] hover:bg-[#3d9166]'
                      : pendingAction === 'reject'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Confirm {pendingAction === 'approve' ? 'Approval' : pendingAction === 'reject' ? 'Rejection' : 'Status Change'}
                </button>
                <button
                  onClick={cancelApprovalAction}
                  className="flex-1 px-4 py-2 bg-[#1E1E1E] hover:bg-[#2C2C2C] text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}