import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Alert } from '../lib/supabase';
import { AlertTriangle, CheckCircle, XCircle, Filter } from 'lucide-react';
import { useNotification } from '../components/NotificationContainer';

export default function Alerts() {
  const { appUser } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('active');
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    fetchAlerts();
  }, [appUser, filter]);

  const fetchAlerts = async () => {
    if (!appUser) return;

    try {
      let query = supabase
        .from('alerts')
        .select(`
          *,
          publishers (name, domain)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'active') {
        query = query.in('status', ['pending', 'active']);
      } else if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      if (appUser.role === 'partner') {
        const { data: publishers } = await supabase
          .from('publishers')
          .select('id')
          .eq('partner_id', appUser.id);

        const publisherIds = publishers?.map((p) => p.id) || [];
        if (publisherIds.length > 0) {
          query = query.in('publisher_id', publisherIds);
        } else {
          setAlerts([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'acknowledged',
          acknowledged_by: appUser?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;
      fetchAlerts();
      showSuccess('Alert Acknowledged', 'Alert has been acknowledged successfully');
    } catch (error: any) {
      showError('Error Acknowledging Alert', error.message || 'An unexpected error occurred');
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_by: appUser?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;
      fetchAlerts();
      showSuccess('Alert Resolved', 'Alert has been resolved successfully');
    } catch (error: any) {
      showError('Error Resolving Alert', error.message || 'An unexpected error occurred');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'badge-error';
      case 'high':
        return 'badge-warning';
      case 'medium':
        return 'badge-info';
      default:
        return 'badge-ghost';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'badge-error';
      case 'acknowledged':
        return 'badge-warning';
      case 'resolved':
        return 'badge-success';
      default:
        return 'badge-ghost';
    }
  };

  const getBorderColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-error';
      case 'high':
        return 'border-warning';
      case 'medium':
        return 'border-info';
      default:
        return 'border-base-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#48a77f]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-base-300">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Alerts</h1>
          <p className="text-sm text-neutral-400 mt-1">Monitor and manage system alerts</p>
        </div>

        <div className="tabs tabs-boxed gap-1 rounded-lg" style={{ backgroundColor: '#1a1a1a' }}>
          {(['all', 'active', 'acknowledged', 'resolved'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`tab rounded-lg ${filter === status ? 'tab-active' : ''}`}
              style={filter === status ? { backgroundColor: '#48a77f', color: '#ffffff' } : {}}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="card border border-base-300" style={{ backgroundColor: '#161616' }}>
          <div className="card-body items-center text-center py-16">
            <CheckCircle className="w-16 h-16 text-success mb-4" />
            <h3 className="text-lg font-semibold text-base-content">No alerts found</h3>
            <p className="text-sm text-neutral-400">All clear! No {filter !== 'all' ? filter : ''} alerts at this time.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`card border ${getBorderColor(alert.severity)} border-l-4 shadow-sm hover:shadow-md transition-all duration-200`}
              style={{ backgroundColor: '#161616' }}
            >
              <div className="card-body p-4">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-[280px] space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge ${getSeverityColor(alert.severity)} badge-outline text-xs font-semibold`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="badge badge-outline text-xs">
                        {alert.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className={`badge ${getStatusColor(alert.status)} badge-outline text-xs font-semibold`}>
                        {alert.status === 'pending' ? 'ACTIVE' : alert.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={`flex-shrink-0 mt-0.5 ${
                          alert.severity === 'critical' ? 'text-error' :
                          alert.severity === 'high' ? 'text-warning' :
                          alert.severity === 'medium' ? 'text-info' :
                          'text-neutral-400'
                        }`}
                        size={18}
                      />
                      <div className="flex-1">
                        <h2 className="font-semibold text-base text-base-content leading-relaxed">
                          {alert.message}
                        </h2>
                      </div>
                    </div>

                    {(alert as any).publishers && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-neutral-500">Publisher:</span>
                        <span className="font-medium text-base-content">
                          {(alert as any).publishers.name}
                        </span>
                        <span className="text-neutral-400">
                          ({(alert as any).publishers.domain})
                        </span>
                      </div>
                    )}

                    {alert.details && (alert.details as any).network_code && (
                      <div className="bg-base-300 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold" style={{ color: '#48a77f' }}>Network Code:</span>
                          <span className="text-base-content font-mono">{(alert.details as any).network_code}</span>
                        </div>
                        {(alert.details as any).service_key_status && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-semibold text-primary">Status:</span>
                            <span className={`badge ${
                              (alert.details as any).service_key_status === 'active'
                                ? 'badge-success'
                                : 'badge-error'
                            } badge-sm`}>
                              {(alert.details as any).service_key_status}
                            </span>
                          </div>
                        )}
                        {(alert.details as any).error && (
                          <div className="text-sm">
                            <span className="font-semibold text-error">Error:</span>
                            <p className="text-neutral-300 mt-1 text-xs font-mono bg-base-100 p-2 rounded">
                              {(alert.details as any).error}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-1 text-xs text-neutral-500">
                      <div className="flex items-center gap-2">
                        <span>Created:</span>
                        <span className="font-mono">{new Date(alert.created_at).toLocaleString()}</span>
                      </div>
                      {alert.acknowledged_at && (
                        <div className="flex items-center gap-2">
                          <span>Acknowledged:</span>
                          <span className="font-mono">{new Date(alert.acknowledged_at).toLocaleString()}</span>
                        </div>
                      )}
                      {alert.resolved_at && (
                        <div className="flex items-center gap-2">
                          <span>Resolved:</span>
                          <span className="font-mono">{new Date(alert.resolved_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.status === 'pending' && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="btn btn-sm btn-outline btn-warning flex items-center gap-1"
                      >
                        <CheckCircle size={14} />
                        Acknowledge
                      </button>
                    )}
                    {alert.status !== 'resolved' && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="btn btn-sm btn-outline btn-success flex items-center gap-1"
                      >
                        <CheckCircle size={14} />
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
