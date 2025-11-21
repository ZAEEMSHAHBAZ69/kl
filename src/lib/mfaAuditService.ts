import { supabase } from './supabase';
import { FingerprintService } from './fingerprintService';
import { ContentFingerprintEngine } from './contentFingerprintEngine';

export interface AuditCheck {
  category: 'structure' | 'content' | 'ux' | 'performance';
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'error';
  score: number;
  details: Record<string, any>;
}

export interface ContentFlag {
  type: 'plagiarism' | 'auto_generated' | 'prohibited' | 'low_content' | 'deceptive_ui' | 'excessive_ads' | 'no_policy' | 'no_ads_txt' | 'broken_links' | 'poor_performance';
  severity: 'minor' | 'major' | 'critical';
  description: string;
  evidence: Record<string, any>;
}

export interface ContentQualityMetrics {
  entropyScore: number;
  hasLowEntropy: boolean;
  duplicateMatches: number;
  contentNetworkFlag: boolean;
  averageMetrics: {
    entropy: number;
    wordCount: number;
  };
}

export interface AuditResult {
  checks: AuditCheck[];
  flags: ContentFlag[];
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class MFAAuditService {
  private static calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'high';
    return 'critical';
  }

  static async createAudit(publisherId: string, siteUrl: string) {
    const { data, error } = await supabase
      .from('site_audits')
      .insert({
        publisher_id: publisherId,
        domain: siteUrl,
        status: 'pending',
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async updateAuditStatus(
    auditId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    result?: AuditResult
  ) {
    const updateData: any = { status };

    if (result) {
      updateData.overall_score = result.overallScore;
      updateData.risk_level = result.riskLevel;
      updateData.raw_results = result;
    }

    const { error } = await supabase
      .from('site_audits')
      .update(updateData)
      .eq('id', auditId);

    if (error) throw error;
  }

  static async saveAuditResults(auditId: string, result: AuditResult) {
    for (const check of result.checks) {
      const { error } = await supabase
        .from('compliance_checks')
        .insert({
          audit_id: auditId,
          check_category: check.category,
          check_name: check.name,
          status: check.status,
          score: check.score,
          details: check.details,
        });

      if (error) console.error('Error saving check:', error);
    }

    for (const flag of result.flags) {
      const { error } = await supabase
        .from('content_flags')
        .insert({
          audit_id: auditId,
          flag_type: flag.type,
          severity: flag.severity,
          description: flag.description,
          evidence: flag.evidence,
        });

      if (error) console.error('Error saving flag:', error);
    }
  }

  static async getPublisherAudits(publisherId: string) {
    const { data, error } = await supabase
      .from('site_audits')
      .select('*')
      .eq('publisher_id', publisherId)
      .order('audit_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getAuditDetails(auditId: string) {
    const [auditResult, checksResult, flagsResult] = await Promise.all([
      supabase.from('site_audits').select('*').eq('id', auditId).maybeSingle(),
      supabase.from('compliance_checks').select('*').eq('audit_id', auditId),
      supabase.from('content_flags').select('*').eq('audit_id', auditId),
    ]);

    if (auditResult.error) throw auditResult.error;

    return {
      audit: auditResult.data,
      checks: checksResult.data || [],
      flags: flagsResult.data || [],
    };
  }

  static async getAllAudits(filters?: {
    riskLevel?: string;
    status?: string;
    partnerId?: string;
  }) {
    let query = supabase
      .from('site_audits')
      .select(`
        *,
        publishers:publisher_id (
          id,
          name,
          domain,
          partner_id
        )
      `)
      .order('audit_date', { ascending: false });

    if (filters?.riskLevel) {
      query = query.eq('risk_level', filters.riskLevel);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (filters?.partnerId && data) {
      return data.filter((audit: any) => audit.publishers?.partner_id === filters.partnerId);
    }

    return data || [];
  }

  static async updatePublisherMFAScore(publisherId: string, score: number) {
    const { error } = await supabase
      .from('publishers')
      .update({
        mfa_score: score,
        mfa_last_check: new Date().toISOString(),
      })
      .eq('id', publisherId);

    if (error) throw error;
  }

  static async analyzeContentQuality(auditId: string): Promise<ContentQualityMetrics> {
    try {
      const report = await FingerprintService.generateAuditReport(auditId);

      const lowEntropyFlag = report.lowEntropyCount > 0;
      const duplicateFlag = report.potentialDuplicateCount > 0;
      const contentNetworkFlag = report.contentNetworks.length > 0;

      const averageEntropy =
        report.totalPages > 0 ? report.averageEntropy : 0;

      return {
        entropyScore: averageEntropy,
        hasLowEntropy: lowEntropyFlag,
        duplicateMatches: report.potentialDuplicateCount,
        contentNetworkFlag,
        averageMetrics: {
          entropy: averageEntropy,
          wordCount: 0,
        },
      };
    } catch (error) {
      console.error('Error analyzing content quality:', error);
      return {
        entropyScore: 0,
        hasLowEntropy: false,
        duplicateMatches: 0,
        contentNetworkFlag: false,
        averageMetrics: {
          entropy: 0,
          wordCount: 0,
        },
      };
    }
  }

  static async generateContentQualityFlags(
    auditId: string,
    contentQuality: ContentQualityMetrics
  ): Promise<ContentFlag[]> {
    const flags: ContentFlag[] = [];

    if (contentQuality.hasLowEntropy) {
      flags.push({
        type: 'auto_generated',
        severity: 'major',
        description: `Content shows low entropy (${(contentQuality.entropyScore * 100).toFixed(1)}%) suggesting repetitive, templated, or AI-generated text. Entropy score below 0.35 indicates thin content.`,
        evidence: {
          entropyScore: contentQuality.entropyScore,
          threshold: 0.35,
          flaggedPages: contentQuality.duplicateMatches,
        },
      });
    }

    if (contentQuality.duplicateMatches > 0) {
      flags.push({
        type: 'plagiarism',
        severity: 'critical',
        description: `${contentQuality.duplicateMatches} pages contain near-duplicate content detected across multiple domains. Content network detected suggesting templated content reuse.`,
        evidence: {
          duplicateCount: contentQuality.duplicateMatches,
          simhashThreshold: 3,
        },
      });
    }

    if (contentQuality.contentNetworkFlag) {
      flags.push({
        type: 'low_content',
        severity: 'critical',
        description: 'Content network identified - multiple domains with similar content patterns detected, indicating possible content farm or PBN network.',
        evidence: {
          networkDetected: true,
          contentNetworkIndicator: true,
        },
      });
    }

    return flags;
  }

  static async addContentFingerprintToResult(
    auditId: string,
    result: AuditResult
  ): Promise<AuditResult> {
    try {
      const contentQuality = await this.analyzeContentQuality(auditId);
      const qualityFlags = await this.generateContentQualityFlags(auditId, contentQuality);

      result.flags = [...result.flags, ...qualityFlags];

      const qualityScore = this.calculateContentQualityScore(contentQuality);
      const existingScore = result.overallScore || 0;
      result.overallScore = (existingScore + qualityScore) / 2;
      result.riskLevel = this.calculateRiskLevel(result.overallScore);

      return result;
    } catch (error) {
      console.error('Error adding content fingerprint to result:', error);
      return result;
    }
  }

  private static calculateContentQualityScore(metrics: ContentQualityMetrics): number {
    let score = 100;

    if (metrics.hasLowEntropy) {
      score -= 30;
    }

    if (metrics.duplicateMatches > 0) {
      score -= Math.min(metrics.duplicateMatches * 5, 40);
    }

    if (metrics.contentNetworkFlag) {
      score -= 25;
    }

    return Math.max(score, 0);
  }

}
