import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Publisher, Alert } from '../lib/supabase';
import { convertToUSD } from '../lib/currencyService';
import MCMInsightsCard from '../components/MCMInsightsCard';
import MFAAnalyticsCard from '../components/MFAAnalyticsCard';
import StatCardSkeleton from '../components/StatCardSkeleton';
import ListItemSkeleton from '../components/ListItemSkeleton';
import {
  Users,
  TrendingUp,
  DollarSign,
  Shield,
  CheckCircle,
  XCircle,
  X
} from 'lucide-react';

interface Stats {
  totalPublishers: number;
  activePublishers: number;
  pendingPublishers: number;
  totalRevenue: number;
  activeAlerts: number;
  mfaIssues: number;
}

export default function Dashboard() {
  const { appUser } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalPublishers: 0,
    activePublishers: 0,
    pendingPublishers: 0,
    totalRevenue: 0,
    activeAlerts: 0,
    mfaIssues: 0,
  });
  const [recentPublishers, setRecentPublishers] = useState<Publisher[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [appUser]);

  const fetchDashboardData = async () => {
    // Proceed even if appUser hasn't loaded; use safe defaults

    try {
      let publishersQuery = supabase.from('publishers').select('*');
      const effectiveRole = appUser?.role || 'partner';
      if (effectiveRole === 'partner' && appUser?.id) {
        publishersQuery = publishersQuery.eq('partner_id', appUser.id);
      }

      const { data: publishers } = await publishersQuery;

      let alertsQuery = supabase
        .from('alerts')
        .select('*')
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (effectiveRole === 'partner') {
        const publisherIds = publishers?.map(p => p.id) || [];
        if (publisherIds.length > 0) {
          alertsQuery = alertsQuery.in('publisher_id', publisherIds);
        }
      }

      const { data: alerts } = await alertsQuery;

      let totalRevenue = 0;

      if (publishers && publishers.length > 0) {
        const publisherIds = publishers.map(p => p.id);

        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startDate = firstDayOfMonth.toISOString().split('T')[0];

        const { data: revenueData } = await supabase
          .from('reports_daily')
          .select('revenue, publisher_id, date, currency_code, publishers!inner(currency_code)')
          .in('publisher_id', publisherIds)
          .gte('date', startDate);

        if (revenueData && revenueData.length > 0) {
          const conversionPromises = revenueData.map(async (record) => {
            const revenue = parseFloat(record.revenue) || 0;
            const currencyCode = record.currency_code || (record.publishers as any)?.currency_code || 'USD';
            return await convertToUSD(revenue, currencyCode);
          });

          const convertedRevenues = await Promise.all(conversionPromises);
          totalRevenue = convertedRevenues.reduce((sum, rev) => sum + rev, 0);
        }
      }

      const { data: mfaScores } = await supabase
        .from('mfa_composite_scores')
        .select('overall_mfa_score, publisher_id');

      const totalPublishers = publishers?.length || 0;
      const activePublishers = publishers?.filter(p =>
        p.gam_status === 'accepted' && p.service_key_status === 'active'
      ).length || 0;
      const pendingPublishers = publishers?.filter(p =>
        p.gam_status === 'pending'
      ).length || 0;
      const mfaIssues = mfaScores?.filter(score =>
        score.overall_mfa_score < 70
      ).length || 0;

      setStats({
        totalPublishers,
        activePublishers,
        pendingPublishers,
        totalRevenue,
        activeAlerts: alerts?.length || 0,
        mfaIssues,
      });

      setRecentPublishers(publishers?.slice(0, 5) || []);
      setRecentAlerts(alerts || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;

      setRecentAlerts(prev => prev.filter(alert => alert.id !== alertId));
      setStats(prev => ({ ...prev, activeAlerts: prev.activeAlerts - 1 }));
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 relative">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-5 border border-[#48a77f]/20 animate-pulse">
          <div className="h-8 bg-[#2C2C2C] rounded w-48 mb-2"></div>
          <div className="h-4 bg-[#2C2C2C]/60 rounded w-64"></div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Lists Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10">
            <div className="h-6 bg-[#2C2C2C] rounded w-40 mb-4 animate-pulse"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <ListItemSkeleton key={i} />
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10">
            <div className="h-6 bg-[#2C2C2C] rounded w-32 mb-4 animate-pulse"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <ListItemSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10 animate-pulse">
            <div className="h-6 bg-[#2C2C2C] rounded w-48 mb-4"></div>
            <div className="h-32 bg-[#2C2C2C]/40 rounded"></div>
          </div>
          <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10 animate-pulse">
            <div className="h-6 bg-[#2C2C2C] rounded w-48 mb-4"></div>
            <div className="h-32 bg-[#2C2C2C]/40 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Publishers',
      value: stats.totalPublishers,
      icon: Users,
      color: 'bg-[#48a77f]',
      textColor: 'text-[#48a77f]',
    },
    {
      name: 'Pending Review',
      value: stats.pendingPublishers,
      icon: TrendingUp,
      color: 'bg-[#48a77f]',
      textColor: 'text-[#48a77f]',
    },
    {
      name: 'Total Revenue',
      value: `$${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-[#48a77f]',
      textColor: 'text-[#48a77f]',
    },
    {
      name: 'MFA Issues',
      value: stats.mfaIssues,
      icon: Shield,
      color: 'bg-[#48a77f]',
      textColor: 'text-[#48a77f]',
    },
  ];

  return (
    <div className="space-y-6 relative">
      <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-5 border border-[#48a77f]/20">
        <h1 className="text-2xl font-semibold text-white mb-1">
          Dashboard
        </h1>
        <p className="text-sm text-gray-400">
          Welcome back, <span className="text-[#48a77f] font-medium">{appUser?.full_name || appUser?.email}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div
            key={card.name}
            className="group relative"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10 group-hover:border-[#48a77f]/30 transition-all duration-300 overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex-1">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">{card.name}</p>
                  <p className="text-2xl font-semibold text-white">{card.value}</p>
                </div>
                <div className="bg-gradient-to-br from-[#48a77f] to-[#5BBF94] p-3 rounded-lg group-hover:scale-110 transition-transform duration-300">
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#48a77f] to-transparent opacity-50"></div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#48a77f] rounded-full animate-pulse"></span>
            Recent Publishers
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {recentPublishers.length === 0 ? (
              <div className="flex items-center justify-center h-24">
                <p className="text-xs text-gray-400">No publishers yet</p>
              </div>
            ) : (
              recentPublishers.map((publisher) => (
                <div
                  key={publisher.id}
                  className="group/item"
                >
                  <div className="flex items-center justify-between p-3 bg-gradient-to-br from-[#0E0E0E] to-[#161616]/50 rounded-lg border border-[#2C2C2C]/50 group-hover/item:border-[#48a77f]/30 transition-all duration-300">
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium mb-0.5">{publisher.name}</p>
                      <p className="text-xs text-gray-400">{publisher.domain}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wide ${publisher.gam_status === 'accepted' ? 'bg-[#48a77f]/20 text-[#5BBF94] border border-[#48a77f]/30' :
                          publisher.gam_status === 'pending' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' :
                            publisher.gam_status === 'approved' ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' :
                              publisher.gam_status === 'invited' ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30' :
                                publisher.gam_status === 'rejected' ? 'bg-red-600/20 text-red-400 border border-red-600/30' :
                                  publisher.gam_status === 'withdrawn' ? 'bg-[#2C2C2C]/20 text-gray-400 border border-[#2C2C2C]/30' :
                                    publisher.gam_status === 'policy_issues' ? 'bg-orange-600/20 text-orange-400 border border-orange-600/30' :
                                      publisher.gam_status === 'ivt_issues' ? 'bg-pink-600/20 text-pink-400 border border-pink-600/30' :
                                        'bg-[#1E1E1E]/20 text-gray-400 border border-[#2C2C2C]/30'
                        }`}>
                        {publisher.gam_status}
                      </span>
                      {publisher.service_key_status === 'active' ? (
                        <CheckCircle className="w-4 h-4 text-[#48a77f]" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500/70" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#48a77f] to-transparent opacity-50"></div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#48a77f] rounded-full animate-pulse"></span>
            Active Alerts
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {recentAlerts.length === 0 ? (
              <div className="flex items-center justify-center h-24">
                <p className="text-xs text-gray-400">No active alerts</p>
              </div>
            ) : (
              recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="group/alert"
                >
                  <div className="p-3 bg-gradient-to-br from-[#0E0E0E] to-[#161616]/50 rounded-lg border-l-4 border-[#48a77f] overflow-hidden hover:border-[#48a77f]/80 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide ${alert.severity === 'critical' ? 'bg-red-600/20 text-red-400 border border-red-600/30' :
                              alert.severity === 'high' ? 'bg-orange-600/20 text-orange-400 border border-orange-600/30' :
                                alert.severity === 'medium' ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30' :
                                  'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                            }`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs text-gray-400">
                            {alert.type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-white/90 leading-relaxed mb-1.5">{alert.message}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="w-1 h-1 bg-[#48a77f] rounded-full"></span>
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDismissAlert(alert.id)}
                        className="flex-shrink-0 p-1 hover:bg-[#2C2C2C] rounded transition-colors group/dismiss"
                        title="Dismiss alert"
                      >
                        <X className="w-4 h-4 text-gray-500 group-hover/dismiss:text-white transition-colors" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
              MFA Security Posture
            </h2>
            <MFAAnalyticsCard />
          </div>
        </div>

        <div>
          <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50"></div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              MCM Program Insights
            </h2>
            <MCMInsightsCard />
          </div>
        </div>
      </div>

    </div>
  );
}
