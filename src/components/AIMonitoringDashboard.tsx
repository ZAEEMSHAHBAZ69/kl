import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Clock, AlertTriangle, Zap } from "lucide-react";
import {
  getRecentErrors,
  getAdminAlerts,
  getUnacknowledgedAlerts,
  acknowledgeAlert,
  getErrorStats,
  getMCMPaymentErrors,
} from "../lib/aiMonitoringService";
import { useAuth } from "../contexts/AuthContext";

interface ErrorAlert {
  id: string;
  alert_type: string;
  severity: string;
  subject: string;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
}

interface ErrorStats {
  errorsByModel: Record<string, number>;
  errorsByType: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  totalErrors: number;
  totalAlerts: number;
}

interface AuditSummary {
  domain: string;
  risk_score: number;
  mfa_score: number;
  causes: any[];
  fixes: any[];
  created_at: string;
}

export default function AIMonitoringDashboard() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ErrorAlert[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [mcmErrors, setMCMErrors] = useState<any[]>([]);
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"alerts" | "errors" | "mcm" | "audits">("alerts");

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const { data: supabase } = await import("../lib/supabase");

      const [alertsData, errorsData, mcmData, statsData, auditData] = await Promise.all([
        getUnacknowledgedAlerts(),
        getRecentErrors(10),
        getMCMPaymentErrors(10),
        getErrorStats(),
        (async () => {
          try {
            const { data, error } = await supabase
              .from("site_audits")
              .select("site_name, risk_score, ai_report, created_at")
              .eq("status", "completed")
              .order("created_at", { ascending: false })
              .limit(5);
            if (error) throw error;
            return (data || []).map(audit => ({
              domain: audit.site_name,
              risk_score: audit.risk_score,
              mfa_score: audit.ai_report?.mfa_score || 0,
              causes: audit.ai_report?.causes || [],
              fixes: audit.ai_report?.fixes || [],
              created_at: audit.created_at
            }));
          } catch (e) {
            console.error("Error fetching audits:", e);
            return [];
          }
        })()
      ]);

      setAlerts(alertsData);
      setErrors(errorsData);
      setMCMErrors(mcmData);
      setStats(statsData);
      setAudits(auditData);
    } catch (error) {
      console.error("Failed to load monitoring data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledgeAlert(alertId: string) {
    if (!user?.id) return;

    const success = await acknowledgeAlert(alertId, user.id);
    if (success) {
      setAlerts(alerts.filter((a) => a.id !== alertId));
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 border-red-300 text-red-800";
      case "high":
        return "bg-orange-100 border-orange-300 text-orange-800";
      case "medium":
        return "bg-yellow-100 border-yellow-300 text-yellow-800";
      default:
        return "bg-blue-100 border-blue-300 text-blue-800";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="w-4 h-4" />;
      case "high":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading monitoring data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Errors (24h)</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.totalErrors || 0}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical Alerts</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.alertsBySeverity["critical"] || 0}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unacknowledged</p>
              <p className="text-3xl font-bold text-gray-900">{alerts.length}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">MCM Issues</p>
              <p className="text-3xl font-bold text-gray-900">{mcmErrors.length}</p>
            </div>
            <Zap className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="border-b border-gray-200 flex">
          <button
            onClick={() => setActiveTab("alerts")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "alerts"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Critical Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab("errors")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "errors"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            API Errors ({errors.length})
          </button>
          <button
            onClick={() => setActiveTab("mcm")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "mcm"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            MCM Issues ({mcmErrors.length})
          </button>
          <button
            onClick={() => setActiveTab("audits")}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === "audits"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Recent Audits ({audits.length})
          </button>
        </div>

        <div className="p-6">
          {activeTab === "alerts" && (
            <div className="space-y-4">
              {alerts.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  All alerts acknowledged
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        {getSeverityIcon(alert.severity)}
                        <div>
                          <h3 className="font-semibold">{alert.subject}</h3>
                          <p className="text-sm mt-1">{alert.message}</p>
                          <p className="text-xs opacity-75 mt-2">
                            {new Date(alert.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                        className="px-3 py-1 bg-white bg-opacity-75 rounded text-sm font-medium hover:bg-opacity-100 transition-opacity whitespace-nowrap"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "errors" && (
            <div className="space-y-3">
              {errors.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No recent errors</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold">Model</th>
                        <th className="text-left py-2 px-3 font-semibold">Error Type</th>
                        <th className="text-left py-2 px-3 font-semibold">Status</th>
                        <th className="text-left py-2 px-3 font-semibold">Retries</th>
                        <th className="text-left py-2 px-3 font-semibold">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errors.map((error) => (
                        <tr key={error.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3">
                            <span className="font-medium capitalize">{error.model_name || "N/A"}</span>
                          </td>
                          <td className="py-3 px-3 text-gray-600">{error.error_type}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                error.error_status === "resolved"
                                  ? "bg-green-100 text-green-800"
                                  : error.error_status === "retry_exhausted"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {error.error_status}
                            </span>
                          </td>
                          <td className="py-3 px-3">{error.retry_count}/{error.max_retries}</td>
                          <td className="py-3 px-3 text-gray-500 text-xs">
                            {new Date(error.created_at).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "mcm" && (
            <div className="space-y-3">
              {mcmErrors.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No MCM payment issues</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold">Date</th>
                        <th className="text-left py-2 px-3 font-semibold">Total Revenue</th>
                        <th className="text-left py-2 px-3 font-semibold">MCM Amount</th>
                        <th className="text-left py-2 px-3 font-semibold">Error</th>
                        <th className="text-left py-2 px-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mcmErrors.map((error) => (
                        <tr key={error.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3">{error.date}</td>
                          <td className="py-3 px-3 font-medium">${error.total_revenue.toFixed(2)}</td>
                          <td className="py-3 px-3 text-red-600 font-medium">
                            ${error.mcm_auto_payment_revenue.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-gray-600 text-xs">{error.error_reason}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                error.alert_sent
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {error.alert_sent ? "Alerted" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "audits" && (
            <div className="space-y-4">
              {audits.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No recent audits</p>
              ) : (
                audits.map((audit) => (
                  <div key={audit.domain} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{audit.domain}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(audit.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <div className="text-right">
                          <p className="text-xs text-gray-600">Risk Score</p>
                          <p className="text-lg font-bold text-red-600">
                            {(audit.risk_score || 0).toFixed(1)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">MFA Score</p>
                          <p className="text-lg font-bold text-orange-600">
                            {(audit.mfa_score || 0).toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {(audit.causes?.length > 0 || audit.fixes?.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {audit.causes?.length > 0 && (
                          <div>
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">Causes</h5>
                            <ul className="space-y-1">
                              {(Array.isArray(audit.causes) ? audit.causes : []).slice(0, 3).map((cause, i) => (
                                <li key={i} className="text-sm text-gray-600">
                                  • {typeof cause === 'string' ? cause : cause.text || JSON.stringify(cause)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {audit.fixes?.length > 0 && (
                          <div>
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">Fixes</h5>
                            <ul className="space-y-1">
                              {(Array.isArray(audit.fixes) ? audit.fixes : []).slice(0, 3).map((fix, i) => (
                                <li key={i} className="text-sm text-gray-600">
                                  • {typeof fix === 'string' ? fix : fix.text || JSON.stringify(fix)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Errors by Model (24h)</h3>
            <div className="space-y-3">
              {Object.entries(stats.errorsByModel).map(([model, count]) => (
                <div key={model} className="flex items-center justify-between">
                  <span className="text-gray-600 capitalize">{model}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, (count as number) * 10)}%`,
                        }}
                      />
                    </div>
                    <span className="font-semibold text-gray-900 w-8">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Alerts by Severity (24h)</h3>
            <div className="space-y-3">
              {Object.entries(stats.alertsBySeverity).map(([severity, count]) => (
                <div key={severity} className="flex items-center justify-between">
                  <span className="text-gray-600 capitalize">{severity}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          severity === "critical"
                            ? "bg-red-500"
                            : severity === "high"
                              ? "bg-orange-500"
                              : "bg-yellow-500"
                        }`}
                        style={{
                          width: `${Math.min(100, (count as number) * 10)}%`,
                        }}
                      />
                    </div>
                    <span className="font-semibold text-gray-900 w-8">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
