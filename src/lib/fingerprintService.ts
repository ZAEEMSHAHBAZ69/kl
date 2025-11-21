import { supabase } from './supabase';
import { ContentFingerprintEngine, FingerprintMetrics, DuplicateMatch } from './contentFingerprintEngine';

export interface StoredFingerprint {
  id: string;
  domain: string;
  page_url: string;
  audit_id: string;
  simhash_fingerprint: string;
  content_hash: string;
  entropy_score: number;
  content_length: number;
  unique_words: number;
  total_words: number;
  flag_status: string;
  duplicate_matches: DuplicateMatch[];
  content_sample: string;
  created_at: string;
  updated_at: string;
}

export class FingerprintService {
  /**
   * Store fingerprint for an audited page
   */
  static async storeFingerprint(
    auditId: string,
    domain: string,
    pageUrl: string,
    content: string,
    duplicateMatches: DuplicateMatch[] = []
  ): Promise<StoredFingerprint> {
    const metrics = ContentFingerprintEngine.analyzeContent(content, pageUrl);

    const { data, error } = await supabase
      .from('content_fingerprints')
      .insert({
        audit_id: auditId,
        domain,
        page_url: pageUrl,
        simhash_fingerprint: metrics.simhash,
        content_hash: metrics.contentHash,
        entropy_score: metrics.entropyScore,
        content_length: metrics.contentLength,
        unique_words: metrics.uniqueWords,
        total_words: metrics.totalWords,
        flag_status: metrics.flagStatus,
        duplicate_matches: duplicateMatches,
        content_sample: metrics.contentSample,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to store fingerprint');

    return data as StoredFingerprint;
  }

  /**
   * Get fingerprints for a specific audit
   */
  static async getFingerprintsForAudit(auditId: string): Promise<StoredFingerprint[]> {
    const { data, error } = await supabase
      .from('content_fingerprints')
      .select('*')
      .eq('audit_id', auditId);

    if (error) throw error;
    return (data || []) as StoredFingerprint[];
  }

  /**
   * Find potential duplicates across all domains for a given SimHash
   */
  static async findCrossDomainDuplicates(simhash: string): Promise<DuplicateMatch[]> {
    const { data, error } = await supabase
      .from('content_fingerprints')
      .select('domain, simhash_fingerprint, entropy_score')
      .not('simhash_fingerprint', 'is', null)
      .limit(1000);

    if (error) throw error;

    if (!data || data.length === 0) return [];

    return ContentFingerprintEngine.findDuplicateMatches(simhash, data);
  }

  /**
   * Get fingerprints by entropy score threshold
   */
  static async getFingerprintsByEntropyThreshold(
    maxEntropy: number,
    limit: number = 100
  ): Promise<StoredFingerprint[]> {
    const { data, error } = await supabase
      .from('content_fingerprints')
      .select('*')
      .lte('entropy_score', maxEntropy)
      .order('entropy_score', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []) as StoredFingerprint[];
  }

  /**
   * Get flagged content (low entropy or duplicates)
   */
  static async getFlaggedContent(
    status?: 'low_entropy' | 'potential_duplicate' | 'mixed'
  ): Promise<StoredFingerprint[]> {
    let query = supabase.from('content_fingerprints').select('*').neq('flag_status', 'clean');

    if (status) {
      query = query.eq('flag_status', status);
    }

    const { data, error } = await query.order('entropy_score', { ascending: true }).limit(500);

    if (error) throw error;
    return (data || []) as StoredFingerprint[];
  }

  /**
   * Update fingerprint with duplicate matches
   */
  static async updateDuplicateMatches(
    fingerprintId: string,
    duplicateMatches: DuplicateMatch[]
  ): Promise<void> {
    const flagStatus = duplicateMatches.length > 0 ? 'potential_duplicate' : 'clean';

    const { error } = await supabase
      .from('content_fingerprints')
      .update({
        duplicate_matches: duplicateMatches,
        flag_status: flagStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fingerprintId);

    if (error) throw error;
  }

  /**
   * Get content network analysis - similar content across multiple domains
   */
  static async analyzeContentNetwork(minSimilarity: number = 85): Promise<
    Array<{
      domains: string[];
      averageEntropy: number;
      count: number;
      matchCount: number;
    }>
  > {
    const { data: fingerprints, error } = await supabase
      .from('content_fingerprints')
      .select('domain, simhash_fingerprint, entropy_score, duplicate_matches')
      .not('duplicate_matches', 'is', null);

    if (error) throw error;
    if (!fingerprints || fingerprints.length === 0) return [];

    const networks = new Map<
      string,
      { domains: Set<string>; entropies: number[]; matches: number }
    >();

    for (const fp of fingerprints) {
      if (!fp.duplicate_matches || fp.duplicate_matches.length === 0) continue;

      const matches = fp.duplicate_matches.filter((m: DuplicateMatch) => m.similarity >= minSimilarity);
      if (matches.length === 0) continue;

      const key = [fp.domain, ...matches.map((m: DuplicateMatch) => m.domain)].sort().join('|');
      const existing = networks.get(key) || {
        domains: new Set([fp.domain]),
        entropies: [fp.entropy_score || 0],
        matches: 0,
      };

      for (const match of matches) {
        existing.domains.add(match.domain);
        existing.entropies.push(match.entropyScore);
      }
      existing.matches += matches.length;

      networks.set(key, existing);
    }

    return Array.from(networks.values())
      .filter(net => net.domains.size > 1)
      .map(net => ({
        domains: Array.from(net.domains),
        averageEntropy: net.entropies.reduce((a, b) => a + b, 0) / net.entropies.length,
        count: net.domains.size,
        matchCount: net.matches,
      }))
      .sort((a, b) => a.averageEntropy - b.averageEntropy);
  }

  /**
   * Bulk analyze and store fingerprints for multiple pages
   */
  static async bulkAnalyzeAndStore(
    auditId: string,
    domain: string,
    pages: Array<{ url: string; content: string }>
  ): Promise<StoredFingerprint[]> {
    const stored: StoredFingerprint[] = [];

    for (const page of pages) {
      try {
        const duplicates = await this.findCrossDomainDuplicates(
          ContentFingerprintEngine.generateSimHash(page.content)
        );

        const fingerprint = await this.storeFingerprint(auditId, domain, page.url, page.content, duplicates);
        stored.push(fingerprint);
      } catch (error) {
        console.error(`Failed to analyze page ${page.url}:`, error);
      }
    }

    return stored;
  }

  /**
   * Generate audit report for content quality
   */
  static async generateAuditReport(auditId: string): Promise<{
    totalPages: number;
    lowEntropyCount: number;
    potentialDuplicateCount: number;
    averageEntropy: number;
    contentNetworks: Array<{
      domains: string[];
      averageEntropy: number;
      count: number;
    }>;
    flaggedPages: StoredFingerprint[];
  }> {
    const fingerprints = await this.getFingerprintsForAudit(auditId);
    const flaggedPages = fingerprints.filter(fp => fp.flag_status !== 'clean');

    const lowEntropyCount = flaggedPages.filter(fp => fp.flag_status === 'low_entropy').length;
    const potentialDuplicateCount = flaggedPages.filter(fp => fp.flag_status === 'potential_duplicate').length;

    const averageEntropy =
      fingerprints.length > 0
        ? fingerprints.reduce((sum, fp) => sum + (fp.entropy_score || 0), 0) / fingerprints.length
        : 0;

    const networks = await this.analyzeContentNetwork(80);

    return {
      totalPages: fingerprints.length,
      lowEntropyCount,
      potentialDuplicateCount,
      averageEntropy,
      contentNetworks: networks.map(n => ({
        domains: n.domains,
        averageEntropy: n.averageEntropy,
        count: n.count,
      })),
      flaggedPages,
    };
  }
}
