import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, Clock, TrendingDown } from 'lucide-react';

interface SiteAudit {
  id: string;
  site_name: string;
  publisher_id: string;
  status: string;
  risk_score: string | number;
  created_at: string;
}

export default function RecentAuditsCard() {
  const [audits, setAudits] = useState<SiteAudit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentAudits();
  }, []);

  const fetchRecentAudits = async () => {
    try {
      const { data, error } = await supabase
        .from('site_audits')
        .select('id, site_name, publisher_id, status, risk_score, created_at')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      setAudits(data || []);
    } catch (error) {
      console.error('Error fetching recent audits:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: string | number) => {
    const num = typeof score === 'string' ? parseFloat(score) : score;
    if (num >= 75) return 'text-red-600';
    if (num >= 50) return 'text-orange-600';
    if (num >= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getRiskBgColor = (score: string | number) => {
    const num = typeof score === 'string' ? parseFloat(score) : score;
    if (num >= 75) return 'bg-red-50';
    if (num >= 50) return 'bg-orange-50';
    if (num >= 25) return 'bg-yellow-50';
    return 'bg-green-50';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <TrendingDown className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Audits</h3>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Audits</h3>
        <p className="text-gray-500 text-center py-8">No audits available yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Audits</h3>
        <span className="text-sm text-gray-500">{audits.length} total</span>
      </div>

      <div className="space-y-3">
        {audits.map((audit) => (
          <div key={audit.id} className={`p-3 rounded-lg border border-gray-200 ${getRiskBgColor(audit.risk_score)}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(audit.status)}
                  <p className="font-medium text-gray-900 truncate">{audit.site_name}</p>
                </div>
                <p className="text-sm text-gray-600">{formatDate(audit.created_at)}</p>
              </div>
              <div className={`text-right ml-2 ${getRiskColor(audit.risk_score)}`}>
                <p className="font-semibold text-sm">{typeof audit.risk_score === 'string' ? parseFloat(audit.risk_score).toFixed(2) : audit.risk_score.toFixed(2)}</p>
                <p className="text-xs opacity-75">Risk Score</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={fetchRecentAudits}
        className="mt-4 w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
      >
        Refresh Audits
      </button>
    </div>
  );
}
