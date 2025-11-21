import { supabase } from './supabase';

export interface ModuleAnalysis {
  module: string;
  issues?: string[];
  causes?: string[];
  fixes?: string[];
  impact?: string;
  good?: string[];
  summary?: string;
}

export interface SiteAudit {
  id: string;
  publisher_id: string;
  site_name?: string;
  domain?: string;
  scanned_at?: string;
  load_time?: number | null;
  has_privacy_policy?: boolean;
  has_contact_page?: boolean;
  ads_txt_valid?: boolean;
  content_length?: number;
  content_uniqueness?: number | null;
  ad_density?: number | null;
  page_speed_score?: number | null;
  mobile_friendly?: boolean;
  popups_detected?: number;
  broken_links?: number;
  mfa_score?: number | null;
  raw_html_snapshot?: string | null;
  error_message?: string | null;
  scan_status?: 'completed' | 'failed' | 'in_progress';
  status?: 'completed' | 'failed' | 'in_progress' | 'pending' | 'processing';
  is_online?: boolean;
  created_at?: string;
  risk_score?: number;
  audit_queue_id?: string;
  crawler_data?: Record<string, any>;
  content_analysis?: Record<string, any>;
  ad_analysis?: Record<string, any>;
  policy_check?: Record<string, any>;
  technical_check?: Record<string, any>;
  ai_report?: {
    llmResponse?: string;
    interpretation?: Record<string, any>;
    modules?: ModuleAnalysis[];
  };
  raw_results?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  updated_at?: string;
  causes?: Record<string, any>[] | null;
  fixes?: Record<string, any>[] | null;
  score_breakdown?: Record<string, any> | null;
}

export interface AuditTriggerResponse {
  success: boolean;
  message: string;
  result?: any;
  error?: string;
}

export const siteAuditService = {
  async getLatestAuditForPublisher(publisherId: string): Promise<SiteAudit | null> {
    try {
      const { data, error } = await supabase
        .from('site_audits')
        .select('*')
        .eq('publisher_id', publisherId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching latest audit:', error);
      throw error;
    }
  },

  async getAuditHistory(publisherId: string, limit = 10): Promise<SiteAudit[]> {
    try {
      const { data, error } = await supabase
        .from('site_audits')
        .select('*')
        .eq('publisher_id', publisherId)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching audit history:', error);
      throw error;
    }
  },

  async getAllAudits(limit = 100): Promise<SiteAudit[]> {
    try {
      const { data, error } = await supabase
        .from('site_audits')
        .select('*')
        .order('scanned_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all audits:', error);
      throw error;
    }
  },


  getRiskLevel(score: number | null): { level: string; color: string; label: string } {
    if (score === null) return { level: 'unknown', color: 'gray', label: 'Unknown' };

    if (score >= 80) return { level: 'low', color: 'green', label: 'Low Risk' };
    if (score >= 60) return { level: 'medium', color: 'yellow', label: 'Medium Risk' };
    if (score >= 40) return { level: 'high', color: 'orange', label: 'High Risk' };
    return { level: 'critical', color: 'red', label: 'Critical Risk' };
  },

  formatScore(score: number | null): string {
    if (score === null) return 'N/A';
    return score.toFixed(1);
  },

  formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  },
};
