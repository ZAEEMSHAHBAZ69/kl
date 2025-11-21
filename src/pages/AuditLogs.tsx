import { useEffect, useState } from 'react';
import { auditDataVerification, DatabaseHealthReport, AuditDataStats } from '../lib/auditDataVerification';
import { AlertCircle, CheckCircle2, TrendingUp, Activity, History } from 'lucide-react';

interface OperationLog {
  id: string;
  timestamp: string;
  level: string;
  operation: string;
  table_name: string;
  status: string;
  message: string;
  duration_ms: number;
  record_count: number;
  error_message?: string;
}

export default function AuditLogs() {
  const [healthReport, setHealthReport] = useState<DatabaseHealthReport | null>(null);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const report = await auditDataVerification.generateHealthReport();
        setHealthReport(report);

        const logs =
          filter === 'all'
            ? await auditDataVerification.getOperationLogsByStatus('success', 50)
            : await auditDataVerification.getOperationLogsByStatus(filter, 50);

        setOperationLogs(logs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch audit data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-white text-xl">Loading audit data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Database Audit Logs</h1>
          <p className="text-slate-400">
            Monitor database operations, performance metrics, and system health
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-red-200">{error}</div>
          </div>
        )}

        {healthReport && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-300 text-sm font-medium">Successful Audits</h3>
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-3xl font-bold text-white mb-2">
                  {healthReport.stats.siteAuditsCount}
                </p>
                <p className="text-sm text-slate-400">
                  {healthReport.stats.auditResultsCount} results stored
                </p>
              </div>

              <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-300 text-sm font-medium">Failed Audits</h3>
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                </div>
                <p className="text-3xl font-bold text-white mb-2">
                  {healthReport.stats.auditFailuresCount}
                </p>
                <p className="text-sm text-slate-400">
                  {((healthReport.stats.auditFailuresCount / (healthReport.stats.siteAuditsCount + healthReport.stats.auditFailuresCount)) * 100).toFixed(1)}%
                  of attempts
                </p>
              </div>

              <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-300 text-sm font-medium">Success Rate</h3>
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-3xl font-bold text-white mb-2">
                  {healthReport.stats.successRate.toFixed(1)}%
                </p>
                <p className="text-sm text-slate-400">
                  System reliability metric
                </p>
              </div>

              <div className="bg-slate-700 rounded-lg p-6 border border-slate-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-300 text-sm font-medium">System Status</h3>
                  <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <p className={`text-2xl font-bold mb-2 ${
                  healthReport.status === 'healthy'
                    ? 'text-green-400'
                    : healthReport.status === 'warning'
                      ? 'text-orange-400'
                      : 'text-red-400'
                }`}>
                  {healthReport.status.charAt(0).toUpperCase() + healthReport.status.slice(1)}
                </p>
                <p className="text-sm text-slate-400">
                  {healthReport.status === 'healthy' ? 'All systems operational' : 'Check details below'}
                </p>
              </div>
            </div>

            {healthReport.recentErrors.length > 0 && (
              <div className="mb-8 bg-red-500/5 border border-red-500/20 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-red-300 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Recent Errors ({healthReport.recentErrors.length})
                </h2>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {healthReport.recentErrors.map((err, idx) => (
                    <div key={idx} className="text-sm text-red-200 bg-red-500/10 p-3 rounded border border-red-500/20">
                      <div className="font-medium">{err.operation} on {err.table}</div>
                      <div className="text-red-300 text-xs mt-1">{err.errorMessage}</div>
                      <div className="text-red-400/70 text-xs mt-1">{new Date(err.timestamp).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {healthReport.slowQueries.length > 0 && (
              <div className="mb-8 bg-orange-500/5 border border-orange-500/20 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-orange-300 mb-4">Slow Queries ({healthReport.slowQueries.length})</h2>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {healthReport.slowQueries.map((q, idx) => (
                    <div key={idx} className="text-sm text-orange-200 bg-orange-500/10 p-3 rounded border border-orange-500/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{q.operation} on {q.table}</div>
                          <div className="text-orange-300 text-xs mt-1">
                            Duration: {q.duration_ms}ms
                          </div>
                        </div>
                        <div className="text-orange-400/70 text-xs">{new Date(q.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="bg-slate-700 rounded-lg border border-slate-600 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Database Operation Logs
            </h2>
            <div className="flex gap-2">
              {(['all', 'success', 'failure'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left px-4 py-3 text-slate-300 font-medium">Timestamp</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-medium">Operation</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-medium">Table</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-medium">Duration</th>
                  <th className="text-left px-4 py-3 text-slate-300 font-medium">Records</th>
                </tr>
              </thead>
              <tbody>
                {operationLogs.length > 0 ? (
                  operationLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-600 hover:bg-slate-600/30 transition">
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-200 font-medium">{log.operation}</td>
                      <td className="px-4 py-3 text-slate-300">{log.table_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            log.status === 'success'
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{log.duration_ms}ms</td>
                      <td className="px-4 py-3 text-slate-300">{log.record_count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No operation logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
