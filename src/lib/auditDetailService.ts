import { supabase } from './supabase';

export interface ModuleAnalysis {
  module: string;
  issues: string[];
  causes: string[];
  fixes: string[];
  impact: string;
  good: string[];
  summary: string;
}

export interface DetailedAuditData {
  siteAuditId: string;
  publisherId: string;
  mfaProbability: number;
  riskScore: number;
  riskLevel: string;
  modules: ModuleAnalysis[];
  rawLlmResponse: string;
  confidence: number;
  updatedAt: string;
}

export class AuditDetailService {
  static async getDetailedAuditData(publisherId: string): Promise<DetailedAuditData | null> {
    try {
      const { data: siteAudit, error: auditError } = await supabase
        .from('site_audits')
        .select(`
          id,
          publisher_id,
          mfa_probability,
          score_breakdown,
          risk_level,
          confidence_score,
          explanation_timestamp,
          updated_at
        `)
        .eq('publisher_id', publisherId)
        .order('updated_at', { ascending: false })
        .maybeSingle();

      if (auditError) throw auditError;
      if (!siteAudit) return null;

      const { data: aiResults, error: aiError } = await supabase
        .from('ai_analysis_results')
        .select('llm_response, interpretation, timestamp')
        .eq('site_audit_id', siteAudit.id)
        .order('timestamp', { ascending: false })
        .maybeSingle();

      if (aiError) throw aiError;

      const modules = aiResults ? this.parseModuleAnalysis(aiResults.llm_response) : [];
      const scoreBreakdown = siteAudit.score_breakdown || {};
      const riskScore = scoreBreakdown.overallRiskScore || 0;

      return {
        siteAuditId: siteAudit.id,
        publisherId: siteAudit.publisher_id,
        mfaProbability: siteAudit.mfa_probability || 0,
        riskScore,
        riskLevel: siteAudit.risk_level || 'UNKNOWN',
        modules,
        rawLlmResponse: aiResults?.llm_response || '',
        confidence: siteAudit.confidence_score || 0,
        updatedAt: siteAudit.updated_at,
      };
    } catch (error) {
      console.error('Error fetching detailed audit data:', error);
      return null;
    }
  }

  private static parseModuleAnalysis(llmResponse: string): ModuleAnalysis[] {
    const modules: ModuleAnalysis[] = [];
    const moduleRegex = /###\s*module\((.*?)\)([\s\S]*?)(?=###\s*module|$)/g;
    let match;

    while ((match = moduleRegex.exec(llmResponse)) !== null) {
      const moduleName = match[1].trim();
      const moduleContent = match[2];

      const issues = this.extractArray(moduleContent, 'found\\(issues:\\[', '\\]');
      const causes = this.extractArray(moduleContent, 'cause(?:\\[|:)\\[', '\\]');
      const fixes = this.extractArray(moduleContent, 'fix(?:\\(|\\[)', '\\]|\\)');
      const good = this.extractArray(moduleContent, 'good\\(\\[', '\\]');

      const impactMatch = moduleContent.match(/impact\([^)]*score_change="([^"]*)"/);
      const impact = impactMatch ? impactMatch[1] : '';

      const summaryMatch = moduleContent.match(/review_summary\("([^"]*)"/);
      const summary = summaryMatch ? summaryMatch[1] : '';

      modules.push({
        module: moduleName,
        issues,
        causes,
        fixes,
        impact,
        good,
        summary,
      });
    }

    return modules;
  }

  private static extractArray(text: string, startPattern: string, endPattern: string): string[] {
    const regex = new RegExp(`${startPattern}([^\\]]+)${endPattern}`);
    const match = text.match(regex);

    if (!match) return [];

    const arrayContent = match[1];
    return arrayContent
      .split(',')
      .map(item => {
        return item
          .trim()
          .replace(/^["']/, '')
          .replace(/["']$/, '')
          .trim();
      })
      .filter(item => item.length > 0);
  }

  static formatProbability(probability: number): string {
    return (probability * 100).toFixed(2);
  }

  static formatRiskScore(score: number): string {
    return (score * 100).toFixed(2);
  }
}
