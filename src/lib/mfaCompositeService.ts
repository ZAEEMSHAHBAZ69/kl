import { supabase } from './supabase';

export interface MFACompositeScore {
  id: string;
  publisher_id: string;
  overall_mfa_score: number;
  mfa_risk_probability?: number;
  mfa_risk_level?: string;
  risk_confidence?: number;
  risk_factors?: any;
  created_at: string;
  updated_at: string;
}

export interface MFAScoreWithPublisher extends MFACompositeScore {
  publishers: {
    id: string;
    name: string;
    domain: string;
    network_code: string;
  };
  gam_metrics_score?: number;
  website_quality_score?: number;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  risk_flags?: string[];
  recommendations?: string[];
  score_breakdown?: {
    gamScore: {
      trafficQuality: number;
      revenueQuality: number;
      invalidTraffic: number;
    };
    websiteScore: {
      contentQuality: number;
      adCompliance: number;
      technicalQuality: number;
      seoEngagement: number;
    };
  };
  gam_data_age_hours?: number;
  audit_data_age_hours?: number;
  calculated_at?: string;
  is_stale?: boolean;
}

export interface RiskLevelStyle {
  label: string;
  color: string;
  bg: string;
}

export class MFACompositeService {
  static async getAllScores(): Promise<MFAScoreWithPublisher[]> {
    const { data, error } = await supabase
      .from('mfa_composite_scores')
      .select(`
        *,
        publishers (
          id,
          name,
          domain,
          network_code
        )
      `)
      .order('overall_mfa_score', { ascending: false });

    if (error) throw error;

    const scores = (data || []) as MFAScoreWithPublisher[];

    return scores.map(score => {
      const riskFactors = score.risk_factors || {};
      const issues = riskFactors.issues || [];
      const fixes = riskFactors.fixes || [];

      return {
        ...score,
        gam_metrics_score: riskFactors.gam_score || 0,
        website_quality_score: riskFactors.website_score || 0,
        risk_level: this.getRiskLevel(score.overall_mfa_score),
        risk_flags: issues,
        recommendations: fixes,
        score_breakdown: {
          gamScore: {
            trafficQuality: riskFactors.traffic_quality || 0,
            revenueQuality: riskFactors.revenue_quality || 0,
            invalidTraffic: riskFactors.invalid_traffic || 0,
          },
          websiteScore: {
            contentQuality: riskFactors.content_quality || 0,
            adCompliance: riskFactors.ad_compliance || 0,
            technicalQuality: riskFactors.technical_quality || 0,
            seoEngagement: riskFactors.seo_engagement || 0,
          },
        },
        gam_data_age_hours: riskFactors.gam_data_age_hours || 0,
        audit_data_age_hours: riskFactors.audit_data_age_hours || 0,
        calculated_at: score.updated_at || new Date().toISOString(),
        is_stale: riskFactors.is_stale || false,
      };
    });
  }

  static async getPublisherScore(publisherId: string): Promise<MFACompositeScore | null> {
    const { data, error } = await supabase
      .from('mfa_composite_scores')
      .select('*')
      .eq('publisher_id', publisherId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score <= 29) return 'low';
    if (score <= 49) return 'medium';
    if (score <= 74) return 'high';
    return 'critical';
  }

  static getRiskLevelFromProbability(probability: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (probability >= 0.75) return 'CRITICAL';
    if (probability >= 0.50) return 'HIGH';
    if (probability >= 0.30) return 'MEDIUM';
    return 'LOW';
  }

  static getRiskLevelStyle(riskLevel: string): RiskLevelStyle {
    const level = riskLevel?.toUpperCase() || 'UNKNOWN';
    switch (level) {
      case 'LOW':
      case 'low':
        return {
          label: 'Low Risk',
          color: '#48a77f',
          bg: 'rgba(72, 167, 127, 0.1)',
        };
      case 'MEDIUM':
      case 'medium':
        return {
          label: 'Medium Risk',
          color: '#FFC107',
          bg: 'rgba(255, 193, 7, 0.1)',
        };
      case 'HIGH':
      case 'high':
        return {
          label: 'High Risk',
          color: '#FF9800',
          bg: 'rgba(255, 152, 0, 0.1)',
        };
      case 'CRITICAL':
      case 'critical':
        return {
          label: 'Critical Risk',
          color: '#F44336',
          bg: 'rgba(244, 67, 54, 0.1)',
        };
      default:
        return {
          label: 'Unknown',
          color: '#999',
          bg: 'rgba(153, 153, 153, 0.1)',
        };
    }
  }

  static formatDataAge(hours: number): string {
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  static getScoreColor(score: number): string {
    if (score >= 80) return '#48a77f';
    if (score >= 60) return '#FFC107';
    if (score >= 40) return '#FF9800';
    return '#F44336';
  }

  static getScorePercentage(score: number): number {
    return Math.min(100, Math.max(0, score));
  }
}
