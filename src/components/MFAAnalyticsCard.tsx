import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, TrendingDown } from 'lucide-react';

interface MFAAnalytics {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
  average_score: number;
}

export default function MFAAnalyticsCard() {
  const [mfaStats, setMfaStats] = useState<MFAAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMFAAnalytics();
  }, []);

  const fetchMFAAnalytics = async () => {
    try {
      const { data: audits, error } = await supabase
        .from('site_audits')
        .select('mfa_probability, publisher_id')
        .not('mfa_probability', 'is', null);

      if (error) throw error;

      if (!audits || audits.length === 0) {
        setMfaStats(null);
        setLoading(false);
        return;
      }

      const stats = {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
        average_score: 0,
      };

      let totalScore = 0;
      audits.forEach((audit) => {
        const scoreValue = typeof audit.mfa_probability === 'number'
          ? audit.mfa_probability * 100
          : (parseFloat(audit.mfa_probability) || 0) * 100;
        totalScore += scoreValue;

        if (scoreValue >= 80) stats.excellent++;
        else if (scoreValue >= 60) stats.good++;
        else if (scoreValue >= 40) stats.fair++;
        else stats.poor++;
      });

      stats.average_score = audits.length > 0 ? totalScore / audits.length : 0;

      setMfaStats(stats);
    } catch (error) {
      console.error('Error fetching MFA analytics:', error);
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

  if (!mfaStats) {
    return (
      <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">MFA Security Posture</h3>
        <p className="text-xs text-gray-500">No MFA data available</p>
      </div>
    );
  }

  const total = mfaStats.excellent + mfaStats.good + mfaStats.fair + mfaStats.poor;
  const excellentPct = total > 0 ? (mfaStats.excellent / total) * 100 : 0;
  const goodPct = total > 0 ? (mfaStats.good / total) * 100 : 0;
  const fairPct = total > 0 ? (mfaStats.fair / total) * 100 : 0;
  const poorPct = total > 0 ? (mfaStats.poor / total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-lg p-4 border border-[#48a77f]/10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-300">Average MFA Score</p>
          <span className={`text-2xl font-bold ${
            mfaStats.average_score >= 80 ? 'text-green-400' :
            mfaStats.average_score >= 60 ? 'text-blue-400' :
            mfaStats.average_score >= 40 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {mfaStats.average_score.toFixed(1)}
          </span>
        </div>
        <div className="w-full bg-[#2C2C2C] rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              mfaStats.average_score >= 80 ? 'bg-gradient-to-r from-green-600 to-green-500' :
              mfaStats.average_score >= 60 ? 'bg-gradient-to-r from-blue-600 to-blue-500' :
              mfaStats.average_score >= 40 ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' :
              'bg-gradient-to-r from-red-600 to-red-500'
            }`}
            style={{ width: `${Math.min(mfaStats.average_score, 100)}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-green-600/10 border border-green-600/20 rounded-lg p-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-gray-400">Excellent</p>
            <p className="text-green-400 font-semibold">{mfaStats.excellent} ({excellentPct.toFixed(0)}%)</p>
          </div>
        </div>
        <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-gray-400">Good</p>
            <p className="text-blue-400 font-semibold">{mfaStats.good} ({goodPct.toFixed(0)}%)</p>
          </div>
        </div>
        <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-lg p-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-gray-400">Fair</p>
            <p className="text-yellow-400 font-semibold">{mfaStats.fair} ({fairPct.toFixed(0)}%)</p>
          </div>
        </div>
        <div className="bg-red-600/10 border border-red-600/20 rounded-lg p-2 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-gray-400">Poor</p>
            <p className="text-red-400 font-semibold">{mfaStats.poor} ({poorPct.toFixed(0)}%)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
