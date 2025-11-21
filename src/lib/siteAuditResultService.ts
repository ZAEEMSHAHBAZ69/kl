import { supabase } from './supabase';

export interface ContentAnalysis {
  textLength: number;
  analysisTimestamp: string;
  entropy: {
    entropyScore: number;
    isLowEntropy: boolean;
    contentLength: number;
    flagStatus: string;
  };
  similarity: {
    simhashFingerprint: string;
    contentHash: string;
    tokenCount: number;
  };
  readability: {
    readabilityScore: number;
    gradeLevel: number;
    readabilityLevel: string;
    humanAuthorIndicators: any;
  };
  ai: {
    aiGeneratedScore: number;
    aiGeneratedProbability: number;
    flagStatus: string;
  };
  clickbait: {
    clickbaitScore: number;
    detected: boolean;
    patterns: string[];
  };
  freshness: {
    freshnessScore: number;
    lastContentUpdate: string;
  };
}

export interface AdAnalysis {
  success: boolean;
  data: {
    timestamp: string;
    metadata: any;
    density: any;
    refresh: any;
    positioning: any;
    visibility: any;
    summary: string;
  };
}

export interface PolicyCheck {
  timestamp: string;
  domain: string;
  jurisdiction: {
    primaryJurisdiction: string;
    allJurisdictions: string[];
  };
  violations: any[];
  complianceLevel: string;
  policies: string[];
  summary: string;
}

export interface TechnicalCheck {
  timestamp: string;
  domain: string;
  components: {
    performance: any;
    ssl: any;
    whois: any;
    links: any;
  };
  technicalHealthScore: number;
  summary: {
    totalIssues: number;
    criticalIssues: string[];
    warnings: string[];
  };
}

export interface ScorerResult {
  auditId: string;
  publisherId: string;
  riskScore: number;
  mfaProbability: number;
  scores: any;
  trend: any;
  benchmarks: any;
  patternDrift: any;
}

export interface AIAssistanceResult {
  llmResponse: string;
  interpretation: {
    rawResponse: string;
    modules: any[];
  };
  timestamp: string;
  metadata: any;
}

export interface SiteAuditResult {
  id: string;
  publisherId: string;
  siteName: string;
  status: string;
  riskScore: number;
  crawlerData: any;
  contentAnalysis: ContentAnalysis | null;
  adAnalysis: AdAnalysis | null;
  policyCheck: PolicyCheck | null;
  technicalCheck: TechnicalCheck | null;
  aiReport: AIAssistanceResult | null;
  mfaProbability: number;
  mfaScore: number;
  riskLevel: string;
  createdAt: string;
  updatedAt: string;
  publisherName: string;
  publisherDomain: string;
}

export class SiteAuditResultService {
  static async getLatestAuditForPublisher(publisherId: string): Promise<SiteAuditResult | null> {
    try {
      const { data, error } = await supabase
        .from('site_audits')
        .select(`
          id,
          publisher_id,
          site_name,
          status,
          risk_score,
          mfa_probability,
          risk_level,
          crawler_data,
          content_analysis,
          ad_analysis,
          policy_check,
          technical_check,
          ai_report,
          raw_results,
          created_at,
          updated_at
        `)
        .eq('publisher_id', publisherId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const publisher = await this.getPublisherInfo(publisherId);

      return {
        id: data.id,
        publisherId: data.publisher_id,
        siteName: data.site_name,
        status: data.status,
        riskScore: data.risk_score || 0,
        crawlerData: data.crawler_data,
        contentAnalysis: data.content_analysis,
        adAnalysis: data.ad_analysis,
        policyCheck: data.policy_check,
        technicalCheck: data.technical_check,
        aiReport: data.ai_report,
        mfaProbability: (data.mfa_probability || 0) / 100,
        mfaScore: data.risk_score || 0,
        riskLevel: data.risk_level || this.getRiskLevel(data.risk_score || 0),
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        publisherName: publisher?.name || 'Unknown',
        publisherDomain: publisher?.domain || '',
      };
    } catch (error) {
      console.error('Error fetching latest audit:', error);
      return null;
    }
  }

  static async getPublishersWithAudits(): Promise<SiteAuditResult[]> {
    try {
      const { data: publishers, error: publishersError } = await supabase
        .from('publishers')
        .select('id, name, domain');

      if (publishersError) throw publishersError;

      const auditPromises = (publishers || []).map(pub =>
        this.getLatestAuditForPublisher(pub.id).then(audit => audit || null)
      );

      const audits = await Promise.all(auditPromises);
      return audits.filter((audit): audit is SiteAuditResult => audit !== null);
    } catch (error) {
      console.error('Error fetching publishers with audits:', error);
      return [];
    }
  }

  static async getPublisherInfo(publisherId: string): Promise<{ name: string; domain: string } | null> {
    try {
      const { data, error } = await supabase
        .from('publishers')
        .select('name, domain')
        .eq('id', publisherId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching publisher info:', error);
      return null;
    }
  }

  static getRiskLevel(score: number): string {
    if (score <= 29) return 'LOW';
    if (score <= 49) return 'MEDIUM';
    if (score <= 74) return 'HIGH';
    return 'CRITICAL';
  }

  static getRiskLevelStyle(riskLevel: string) {
    const level = riskLevel?.toUpperCase() || 'UNKNOWN';
    switch (level) {
      case 'LOW':
        return { label: 'Low Risk', color: '#48a77f', bg: 'rgba(72, 167, 127, 0.1)' };
      case 'MEDIUM':
        return { label: 'Medium Risk', color: '#FFC107', bg: 'rgba(255, 193, 7, 0.1)' };
      case 'HIGH':
        return { label: 'High Risk', color: '#FF9800', bg: 'rgba(255, 152, 0, 0.1)' };
      case 'CRITICAL':
        return { label: 'Critical Risk', color: '#F44336', bg: 'rgba(244, 67, 54, 0.1)' };
      default:
        return { label: 'Unknown', color: '#999', bg: 'rgba(153, 153, 153, 0.1)' };
    }
  }

  static extractIssuesFromAiReport(aiReport: AIAssistanceResult | null): string[] {
    if (!aiReport) return [];

    const issues: string[] = [];

    if (aiReport.interpretation?.modules && Array.isArray(aiReport.interpretation.modules)) {
      aiReport.interpretation.modules.forEach((module: any) => {
        if (module.issues && Array.isArray(module.issues)) {
          issues.push(...module.issues);
        } else if (module.found?.issues && Array.isArray(module.found.issues)) {
          issues.push(...module.found.issues);
        }
      });
    }

    if (aiReport.llmResponse && typeof aiReport.llmResponse === 'string') {
      const issuesMatch = aiReport.llmResponse.match(/found\(issues:\[(.*?)\]\)/);
      if (issuesMatch) {
        const issuesStr = issuesMatch[1];
        const matches = issuesStr.match(/"([^"]+)"/g);
        if (matches) {
          matches.forEach(match => {
            const cleaned = match.replace(/"/g, '');
            if (cleaned && !issues.includes(cleaned)) {
              issues.push(cleaned);
            }
          });
        }
      }
    }

    return issues.slice(0, 10);
  }

  static extractFixesFromAiReport(aiReport: AIAssistanceResult | null): string[] {
    if (!aiReport) return [];

    const fixes: string[] = [];

    if (aiReport.interpretation?.modules && Array.isArray(aiReport.interpretation.modules)) {
      aiReport.interpretation.modules.forEach((module: any) => {
        if (module.fixes && Array.isArray(module.fixes)) {
          fixes.push(...module.fixes);
        } else if (module.fix && Array.isArray(module.fix)) {
          fixes.push(...module.fix);
        }
      });
    }

    if (aiReport.llmResponse && typeof aiReport.llmResponse === 'string') {
      const fixMatch = aiReport.llmResponse.match(/fix\(\["([^"]*)"(?:,\s*"([^"]*))*\]/g) ||
                       aiReport.llmResponse.match(/fix\(\[([^\]]+)\]\)/g);
      if (fixMatch) {
        fixMatch.forEach(match => {
          const cleaned = match.replace(/fix\(\[|\]\)/g, '').replace(/"/g, '').split(',');
          cleaned.forEach(item => {
            const trimmed = item.trim();
            if (trimmed && !fixes.includes(trimmed)) {
              fixes.push(trimmed);
            }
          });
        });
      }
    }

    return fixes.slice(0, 10);
  }

  static getTechnicalScore(technicalCheck: TechnicalCheck | null): number {
    return technicalCheck?.technicalHealthScore || 0;
  }

  static getAdMetrics(adAnalysis: AdAnalysis | null) {
    if (!adAnalysis?.data) return { density: 0, refresh: 0, visibility: 0 };
    return {
      density: adAnalysis.data.density?.score || 0,
      refresh: adAnalysis.data.refresh?.score || 0,
      visibility: adAnalysis.data.visibility?.score || 0,
    };
  }

  static getContentMetrics(contentAnalysis: ContentAnalysis | null) {
    if (!contentAnalysis) return { entropy: 0, readability: 0, freshness: 0 };
    return {
      entropy: contentAnalysis.entropy?.entropyScore || 0,
      readability: contentAnalysis.readability?.readabilityScore || 0,
      freshness: contentAnalysis.freshness?.freshnessScore || 0,
    };
  }

  static formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return 'N/A';
    }
  }

  static getTimeAgo(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;

      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'N/A';
    }
  }
}
