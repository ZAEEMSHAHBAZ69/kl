import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, TrendingUp, Percent } from 'lucide-react';

interface MCMSummary {
  total_publishers: number;
  total_revenue: number;
  total_mcm_deducted: number;
  publisher_net_revenue: number;
  average_payment_percentage: number;
}

export default function MCMInsightsCard() {
  const [mcmData, setMcmData] = useState<MCMSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMCMData();
  }, []);

  const fetchMCMData = async () => {
    try {
      const { data: publishersWithMCM, error } = await supabase
        .from('publishers')
        .select('id, mcm_parent_id')
        .not('mcm_parent_id', 'is', null);

      if (error) throw error;

      if (!publishersWithMCM || publishersWithMCM.length === 0) {
        setMcmData(null);
        setLoading(false);
        return;
      }

      const publisherIds = publishersWithMCM.map(p => p.id);

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startDate = firstDayOfMonth.toISOString().split('T')[0];

      const { data: reports, error: reportsError } = await supabase
        .from('report_historical')
        .select('revenue, mcm_auto_payment_revenue')
        .in('publisher_id', publisherIds)
        .gte('date', startDate);

      if (reportsError) throw reportsError;

      const totalRevenue = reports?.reduce((sum, r) => sum + (parseFloat(r.revenue) || 0), 0) || 0;
      const totalMCMDeducted = reports?.reduce((sum, r) => sum + (parseFloat(r.mcm_auto_payment_revenue) || 0), 0) || 0;
      const avgPaymentPercentage = totalRevenue > 0 ? (totalMCMDeducted / totalRevenue) * 100 : 0;

      setMcmData({
        total_publishers: publishersWithMCM.length,
        total_revenue: totalRevenue,
        total_mcm_deducted: totalMCMDeducted,
        publisher_net_revenue: totalRevenue - totalMCMDeducted,
        average_payment_percentage: avgPaymentPercentage,
      });
    } catch (error) {
      console.error('Error fetching MCM data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-[#2C2C2C] rounded-xl"></div>
      </div>
    );
  }

  if (!mcmData) {
    return (
      <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">MCM Program Insights</h3>
        <p className="text-xs text-gray-500">No MCM publishers configured</p>
      </div>
    );
  }

  const mcmMetrics = [
    {
      label: 'MCM Publishers',
      value: mcmData.total_publishers,
      icon: DollarSign,
      color: 'from-blue-600/20 to-blue-700/20',
      textColor: 'text-blue-400',
      borderColor: 'border-blue-600/30',
    },
    {
      label: 'Month Revenue',
      value: `$${mcmData.total_revenue.toFixed(2)}`,
      icon: TrendingUp,
      color: 'from-green-600/20 to-green-700/20',
      textColor: 'text-green-400',
      borderColor: 'border-green-600/30',
    },
    {
      label: 'Avg Payment %',
      value: `${mcmData.average_payment_percentage.toFixed(1)}%`,
      icon: Percent,
      color: 'from-purple-600/20 to-purple-700/20',
      textColor: 'text-purple-400',
      borderColor: 'border-purple-600/30',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {mcmMetrics.map((metric) => (
          <div
            key={metric.label}
            className={`bg-gradient-to-br ${metric.color} rounded-lg p-3 border ${metric.borderColor}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1">{metric.label}</p>
                <p className={`text-lg font-semibold ${metric.textColor}`}>{metric.value}</p>
              </div>
              <metric.icon className={`w-4 h-4 ${metric.textColor} opacity-60`} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-lg p-3 border border-[#48a77f]/10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400">Net Revenue Split</p>
          <span className="text-xs text-[#48a77f]">{((mcmData.total_mcm_deducted / mcmData.total_revenue) * 100).toFixed(1)}% to MCM</span>
        </div>
        <div className="w-full bg-[#2C2C2C] rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#48a77f] to-[#5BBF94] transition-all duration-500"
            style={{
              width: `${mcmData.total_revenue > 0 ? (mcmData.total_mcm_deducted / mcmData.total_revenue) * 100 : 0}%`,
            }}
          ></div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>MCM: ${mcmData.total_mcm_deducted.toFixed(2)}</span>
          <span>Publishers: ${mcmData.publisher_net_revenue.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
