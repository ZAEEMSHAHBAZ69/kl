import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Publisher } from '../lib/supabase';
import { Plus, Search, ChevronDown, Globe, ExternalLink, Eye, RefreshCw } from 'lucide-react';
import AddPublisherModal from '../components/AddPublisherModal';
import PublisherDetailModal from '../components/PublisherDetailModal';
import { useNotification } from '../components/NotificationContainer';
import TableRowSkeleton from '../components/TableRowSkeleton';

interface PublisherWithPartner extends Publisher {
  partner?: {
    id: string;
    full_name: string | null;
    company_name: string | null;
  };
  mcm_parents?: {
    name: string;
    parent_network_code: string;
  };
  mfa_composite_scores?: Array<{
    overall_mfa_score: number;
  }>;
}

export default function Publishers() {
  const { appUser } = useAuth();
  const [publishers, setPublishers] = useState<PublisherWithPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPublisher, setSelectedPublisher] = useState<PublisherWithPartner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showSuccess, showError } = useNotification();

  const fetchPublishers = useCallback(async () => {
    if (!appUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('publishers')
        .select(`
          *,
          partner:app_users!partner_id (id, full_name, company_name),
          mcm_parents (name, parent_network_code),
          mfa_composite_scores!mfa_composite_scores_publisher_id_fkey (overall_mfa_score)
        `)
        .order('created_at', { ascending: false });

      if (appUser.role === 'partner') {
        query = query.eq('partner_id', appUser.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setPublishers(data || []);
    } catch (error) {
      console.error('Error fetching publishers:', error);
      setPublishers([]);
    } finally {
      setLoading(false);
    }
  }, [appUser]);

  const statusCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    publishers.forEach(p => {
      const status = p.gam_status || 'pending';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [publishers]);

  const uniquePartners = useMemo(() => {
    const partners = new Map();
    publishers.forEach(p => {
      if (p.partner) {
        partners.set(p.partner.id, p.partner);
      }
    });
    return Array.from(partners.values());
  }, [publishers]);

  const partnerCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    publishers.forEach(p => {
      if (p.partner) {
        counts[p.partner.id] = (counts[p.partner.id] || 0) + 1;
      }
    });
    return counts;
  }, [publishers]);

  const filteredPublishers = useMemo(() => {
    let filtered = publishers;

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.network_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => (p.gam_status || 'pending') === statusFilter);
    }

    if (partnerFilter !== 'all') {
      filtered = filtered.filter(p => p.partner?.id === partnerFilter);
    }

    return filtered;
  }, [publishers, searchTerm, statusFilter, partnerFilter]);

  useEffect(() => {
    fetchPublishers();
  }, [fetchPublishers]);

  const handlePublisherCreated = useCallback(() => {
    setShowAddModal(false);
    fetchPublishers();
  }, [fetchPublishers]);

  const handlePublisherDeleted = useCallback(() => {
    fetchPublishers();
  }, [fetchPublishers]);

  const handleRefreshServiceKeys = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-service-key-status', {
        body: { check_all: true }
      });

      if (error) throw error;

      await fetchPublishers();
      showSuccess('Service Keys Checked', 'All service key statuses have been updated');
    } catch (error: any) {
      console.error('Error checking service keys:', error);
      showError('Error Checking Service Keys', error.message || 'An unexpected error occurred');
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchPublishers, showSuccess, showError]);

  const handleStatusChange = useCallback(async (publisherId: string, newStatus: string) => {
    try {
      console.log('Calling update_publisher_status with:', {
        publisher_id: publisherId,
        new_status: newStatus,
        approval_notes: null,
        user_id: appUser?.id
      });

      const { data, error } = await supabase.rpc('update_publisher_status', {
        publisher_id: publisherId,
        new_status: newStatus,
        approval_notes: null,
        user_id: appUser?.id
      })

      console.log('Response:', { data, error });

      if (error) {
        console.error('Supabase RPC error:', error);
        throw error;
      }

      if (data && !data.success) {
        console.error('Function returned error:', data);
        throw new Error(data.error || 'Failed to update status')
      }

      await fetchPublishers()
      setSelectedPublisher(null)
      showSuccess('Status Updated', 'Publisher status updated successfully')
    } catch (error: any) {
      console.error('Error updating status:', error)
      showError('Error Updating Status', error.message || 'An unexpected error occurred')
    }
  }, [appUser?.id, fetchPublishers, showSuccess, showError]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-[#48a77f]/20 text-[#48a77f] border border-[#48a77f]/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'invited':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'rejected':
      case 'not_approved':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'withdrawn':
      case 'policy':
      case 'ivt':
        return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  const getServiceKeyStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-[#48a77f]/20 text-[#48a77f] border border-[#48a77f]/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'invalid':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1 max-w-xl animate-pulse">
            <div className="h-12 bg-[#161616] border border-[#2C2C2C] rounded-lg"></div>
          </div>
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-10 w-36 bg-[#48a77f]/20 rounded-lg"></div>
            <div className="h-10 w-32 bg-[#161616] border border-[#2C2C2C] rounded-lg"></div>
            <div className="h-10 w-32 bg-[#161616] border border-[#2C2C2C] rounded-lg"></div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-[#161616] rounded-lg border border-[#2C2C2C] overflow-hidden">
          <table className="w-full table-fixed">
            <thead className="bg-[#0E0E0E]/50 border-b border-[#2C2C2C]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-1/5">
                  Account/Publisher Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[10%]">
                  Network Code
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[15%]">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[12%]">
                  Site
                </th>
                {appUser?.role !== 'partner' && (
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[12%]">
                    Partner
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[10%]">
                  GAM Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[10%]">
                  Service Key Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[8%]">
                  MFA Score
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-[8%]">
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {[...Array(8)].map((_, i) => (
                <TableRowSkeleton key={i} columns={appUser?.role !== 'partner' ? 9 : 8} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search publishers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#161616] border border-[#2C2C2C] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#48a77f]/50"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#48a77f] hover:bg-[#3d9166] text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Publisher</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#161616] border border-[#2C2C2C] rounded-lg text-white hover:border-[#2C2C2C] transition-colors"
            >
              <span className="text-sm text-gray-400">Status:</span>
              <span className="font-medium">
                {statusFilter === 'all' ? `All Status (${publishers.length})` : `${statusFilter} (${statusCounts[statusFilter] || 0})`}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showStatusDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-[#161616] border border-[#2C2C2C] rounded-lg shadow-xl z-50">
                <div className="p-2">
                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setShowStatusDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-white hover:bg-[#1E1E1E] rounded flex items-center justify-between"
                  >
                    <span>All Status</span>
                    <span className="text-gray-400 text-sm">({publishers.length})</span>
                  </button>
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                        setShowStatusDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-white hover:bg-[#1E1E1E] rounded flex items-center justify-between capitalize"
                    >
                      <span>{status}</span>
                      <span className="text-gray-400 text-sm">({count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {appUser?.role !== 'partner' && (
            <div className="relative">
              <button
                onClick={() => setShowPartnerDropdown(!showPartnerDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#161616] border border-[#2C2C2C] rounded-lg text-white hover:border-[#2C2C2C] transition-colors"
              >
                <span className="text-sm text-gray-400">Partner:</span>
                <span className="font-medium">
                  {partnerFilter === 'all' ? `All Partners (${uniquePartners.length})` : uniquePartners.find(p => p.id === partnerFilter)?.full_name || 'Unknown'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {showPartnerDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-[#161616] border border-[#2C2C2C] rounded-lg shadow-xl z-50">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setPartnerFilter('all');
                        setShowPartnerDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-white hover:bg-[#1E1E1E] rounded flex items-center justify-between"
                    >
                      <span>All Partners</span>
                      <span className="text-gray-400 text-sm">({uniquePartners.length})</span>
                    </button>
                    {uniquePartners.map((partner) => (
                      <button
                        key={partner.id}
                        onClick={() => {
                          setPartnerFilter(partner.id);
                          setShowPartnerDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-white hover:bg-[#1E1E1E] rounded flex items-center justify-between"
                      >
                        <span>{partner.full_name || partner.company_name || 'Unknown'}</span>
                        <span className="text-gray-400 text-sm">({partnerCounts[partner.id] || 0})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#161616] rounded-lg border border-[#2C2C2C] overflow-hidden">
        <div>
          <table className="w-full table-fixed">
            <thead className="bg-[#0E0E0E]/50 border-b border-[#2C2C2C]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-1/5">
                  Account/Publisher Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[10%]">
                  Network Code
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[15%]">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[12%]">
                  Site
                </th>
                {appUser?.role !== 'partner' && (
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[12%]">
                    Partner
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[10%]">
                  GAM Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[10%]">
                  Service Key Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[8%]">
                  MFA Score
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-[8%]">
                  <button
                    onClick={handleRefreshServiceKeys}
                    disabled={isRefreshing}
                    className="p-2 hover:bg-[#1E1E1E] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                    title="Check service key status for all publishers"
                  >
                    <RefreshCw className={`w-4 h-4 text-gray-400 hover:text-[#48a77f] transition-colors ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredPublishers.map((publisher) => (
                <tr
                  key={publisher.id}
                  className="hover:bg-[#1E1E1E]/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedPublisher(publisher)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-white text-sm">{publisher.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {publisher.network_code ? (
                      <a
                        href={`https://admanager.google.com/${publisher.network_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[#48a77f] hover:text-[#3d9166] transition-colors text-sm"
                      >
                        <span>{publisher.network_code}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-gray-500 text-sm">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-white text-sm block overflow-hidden text-ellipsis" title={publisher.contact_email || 'N/A'}>{publisher.contact_email || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <a
                      href={`https://${publisher.domain.replace(/^https?:\/\//, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-[#48a77f] hover:text-[#3d9166] transition-colors text-sm"
                    >
                      <span className="truncate block overflow-hidden text-ellipsis" title={publisher.domain}>{publisher.domain}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </td>
                  {appUser?.role !== 'partner' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-white text-sm block overflow-hidden text-ellipsis" title={publisher.partner?.full_name || publisher.partner?.company_name || 'N/A'}>{publisher.partner?.full_name || publisher.partner?.company_name || 'N/A'}</span>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(publisher.gam_status || 'pending')}`}>
                      {(publisher.gam_status || 'pending').charAt(0).toUpperCase() + (publisher.gam_status || 'pending').slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getServiceKeyStatusColor(publisher.service_key_status || 'pending')}`}>
                      {(publisher.service_key_status || 'pending').charAt(0).toUpperCase() + (publisher.service_key_status || 'pending').slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${(publisher.mfa_composite_scores?.[0]?.overall_mfa_score ?? 0) >= 70
                          ? 'bg-[#48a77f]/20 text-[#48a77f] border border-[#48a77f]/30'
                          : (publisher.mfa_composite_scores?.[0]?.overall_mfa_score ?? 0) >= 45
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : (publisher.mfa_composite_scores?.[0]?.overall_mfa_score ?? 0) >= 30
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                        {publisher.mfa_composite_scores?.[0]?.overall_mfa_score ?? 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPublisher(publisher);
                      }}
                      className="p-2 hover:bg-[#1E1E1E] rounded-lg transition-colors inline-flex items-center justify-center"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5 text-gray-400 hover:text-[#48a77f] transition-colors" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPublishers.length === 0 && (
          <div className="text-center py-12">
            <Globe className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No publishers found</p>
            <p className="text-gray-500 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddPublisherModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={handlePublisherCreated}
          userRole={appUser?.role || 'partner'}
          partnerId={appUser?.id || null}
        />
      )}

      {selectedPublisher && (
        <PublisherDetailModal
          publisher={selectedPublisher}
          onClose={() => setSelectedPublisher(null)}
          onStatusChange={handleStatusChange}
          onPublisherDeleted={handlePublisherDeleted}
          onPublisherUpdated={fetchPublishers}
          userRole={appUser?.role || 'partner'}
        />
      )}
    </div>
  );
}
