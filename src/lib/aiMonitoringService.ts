import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AIModelAnalysis {
  id: string;
  publisher_id: string;
  audit_id: string;
  model_name: string;
  analysis_type: string;
  confidence_score: number;
  score_value: number;
  response_time_ms: number;
  retry_count: number;
  created_at: string;
}

export interface AIAnalysisError {
  id: string;
  publisher_id: string;
  function_name: string;
  error_type: string;
  model_name: string | null;
  error_details: any;
  error_status: string;
  retry_count: number;
  created_at: string;
}

export interface AdminAlert {
  id: string;
  alert_type: string;
  severity: string;
  publisher_id: string | null;
  subject: string;
  message: string;
  metadata: any;
  alert_sent: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

export interface ModelPerformanceMetrics {
  model_name: string;
  avg_response_time: number;
  success_rate: number;
  failure_count_24h: number;
  avg_confidence: number;
  is_degraded: boolean;
}

export async function getModelPerformanceMetrics(): Promise<ModelPerformanceMetrics[]> {
  try {
    const { data: errors, error: errorsFetchError } = await supabase
      .from("ai_analysis_errors")
      .select("model_name, error_status")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (errorsFetchError) throw errorsFetchError;

    const grouped = new Map<string, { total: number; resolved: number }>();
    (errors || []).forEach((e: any) => {
      const model = e.model_name || "unknown";
      if (!grouped.has(model)) {
        grouped.set(model, { total: 0, resolved: 0 });
      }
      const stats = grouped.get(model)!;
      stats.total++;
      if (e.error_status === "resolved") {
        stats.resolved++;
      }
    });

    return Array.from(grouped.entries()).map(([modelName, stats]) => ({
      model_name: modelName,
      avg_response_time: 0,
      success_rate: (stats.resolved / stats.total) * 100,
      failure_count_24h: stats.total - stats.resolved,
      avg_confidence: 0,
      is_degraded: stats.total > 5 && (stats.resolved / stats.total) < 0.8,
    }));
  } catch (error) {
    console.error("Error fetching performance metrics:", error);
    return [];
  }
}

export async function getRecentErrors(limit = 20): Promise<AIAnalysisError[]> {
  try {
    const { data, error } = await supabase
      .from("ai_analysis_errors")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching errors:", error);
    return [];
  }
}

export async function getAdminAlerts(limit = 20): Promise<AdminAlert[]> {
  try {
    const { data, error } = await supabase
      .from("admin_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return [];
  }
}

export async function getUnacknowledgedAlerts(): Promise<AdminAlert[]> {
  try {
    const { data, error } = await supabase
      .from("admin_alerts")
      .select("*")
      .is("acknowledged_at", null)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching unacknowledged alerts:", error);
    return [];
  }
}

export async function acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("admin_alerts")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq("id", alertId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error acknowledging alert:", error);
    return false;
  }
}

export async function getModelAnalysisHistory(
  publisherId: string,
  limit = 50
): Promise<AIModelAnalysis[]> {
  try {
    const { data, error } = await supabase
      .from("ai_model_analysis")
      .select("*")
      .eq("publisher_id", publisherId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching model analysis history:", error);
    return [];
  }
}

export async function getMCMPaymentErrors(limit = 20): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("mcm_payment_errors")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching MCM errors:", error);
    return [];
  }
}

export async function getErrorStats() {
  try {
    const { data: errors, error: errorsError } = await supabase
      .from("ai_analysis_errors")
      .select("model_name, error_status")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (errorsError) throw errorsError;

    const { data: alerts, error: alertsError } = await supabase
      .from("admin_alerts")
      .select("severity, alert_type")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (alertsError) throw alertsError;

    const errorsByModel = new Map<string, number>();
    const errorsByType = new Map<string, number>();
    (errors || []).forEach((e: any) => {
      errorsByModel.set(e.model_name || "unknown", (errorsByModel.get(e.model_name || "unknown") || 0) + 1);
      errorsByType.set(e.error_status || "unknown", (errorsByType.get(e.error_status || "unknown") || 0) + 1);
    });

    const alertsBySeverity = new Map<string, number>();
    (alerts || []).forEach((a: any) => {
      alertsBySeverity.set(a.severity, (alertsBySeverity.get(a.severity) || 0) + 1);
    });

    return {
      errorsByModel: Object.fromEntries(errorsByModel),
      errorsByType: Object.fromEntries(errorsByType),
      alertsBySeverity: Object.fromEntries(alertsBySeverity),
      totalErrors: errors?.length || 0,
      totalAlerts: alerts?.length || 0,
    };
  } catch (error) {
    console.error("Error fetching error stats:", error);
    return {
      errorsByModel: {},
      errorsByType: {},
      alertsBySeverity: {},
      totalErrors: 0,
      totalAlerts: 0,
    };
  }
}
