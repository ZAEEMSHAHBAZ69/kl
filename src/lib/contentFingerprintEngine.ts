export interface FingerprintMetrics {
  entropyScore: number;
  simhash: string;
  contentHash: string;
  contentLength: number;
  uniqueWords: number;
  totalWords: number;
  flagStatus: 'low_entropy' | 'potential_duplicate' | 'clean' | 'mixed';
  contentSample: string;
}

export interface DuplicateMatch {
  domain: string;
  similarity: number;
  entropyScore: number;
}

export class ContentFingerprintEngine {
  private static readonly ENTROPY_THRESHOLD = 0.35;
  private static readonly SIMHASH_DISTANCE_THRESHOLD = 3;

  /**
   * Calculate Shannon entropy of text content
   * Measures how repetitive or uniform the text is
   * Lower entropy (< 0.35) indicates thin, AI-generated, or template-based content
   */
  static calculateEntropy(text: string): number {
    if (!text || text.length === 0) return 0;

    const normalized = this.normalizeText(text);
    const words = normalized.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) return 0;

    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    let entropy = 0;
    const totalWords = words.length;

    for (const count of wordFreq.values()) {
      const probability = count / totalWords;
      entropy -= probability * Math.log2(probability);
    }

    return Math.min(entropy / 8, 1);
  }

  /**
   * Generate SimHash fingerprint for near-duplicate detection
   * 64-bit hash that allows fuzzy matching
   * Hamming distance < 3 indicates near-duplicates
   */
  static generateSimHash(text: string): string {
    const normalized = this.normalizeText(text);
    const shingles = this.generate5Grams(normalized);

    if (shingles.length === 0) return '0'.repeat(64);

    const vector = new Array(64).fill(0);

    for (const shingle of shingles) {
      const hash = this.simpleHash(shingle);
      for (let i = 0; i < 64; i++) {
        if ((hash & (1n << BigInt(i))) > 0n) {
          vector[i]++;
        } else {
          vector[i]--;
        }
      }
    }

    let simhash = '';
    for (let i = 0; i < 64; i++) {
      simhash = (vector[i] > 0 ? '1' : '0') + simhash;
    }

    return simhash;
  }

  /**
   * Generate SHA256-like content hash for exact duplicate detection
   * Using simple hash for browser compatibility (not cryptographic)
   */
  static generateContentHash(text: string): string {
    const normalized = this.normalizeText(text);
    return this.hashString(normalized);
  }

  /**
   * Calculate Hamming distance between two SimHash values
   * Returns number of differing bits (0-64)
   */
  static hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return 64;

    let distance = 0;
    for (let i = 0; i < 64; i++) {
      if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
  }

  /**
   * Analyze text content and return comprehensive metrics
   */
  static analyzeContent(text: string, pageUrl?: string): FingerprintMetrics {
    const normalized = this.normalizeText(text);
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    const uniqueWords = new Set(words).size;
    const entropy = this.calculateEntropy(text);
    const simhash = this.generateSimHash(text);
    const contentHash = this.generateContentHash(text);
    const contentSample = text.substring(0, 500);

    let flagStatus: 'low_entropy' | 'potential_duplicate' | 'clean' | 'mixed' = 'clean';

    if (entropy < this.ENTROPY_THRESHOLD) {
      flagStatus = 'low_entropy';
    }

    return {
      entropyScore: entropy,
      simhash,
      contentHash,
      contentLength: text.length,
      uniqueWords,
      totalWords: words.length,
      flagStatus,
      contentSample,
    };
  }

  /**
   * Identify duplicate matches by comparing against existing fingerprints
   */
  static findDuplicateMatches(
    simhash: string,
    existingFingerprints: Array<{ domain: string; simhash_fingerprint: string; entropy_score: number }>
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];

    for (const existing of existingFingerprints) {
      if (!existing.simhash_fingerprint) continue;

      const distance = this.hammingDistance(simhash, existing.simhash_fingerprint);

      if (distance < this.SIMHASH_DISTANCE_THRESHOLD) {
        matches.push({
          domain: existing.domain,
          similarity: 100 - (distance / 64) * 100,
          entropyScore: existing.entropy_score || 0,
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static generate5Grams(text: string): string[] {
    const grams: string[] = [];
    const words = text.split(/\s+/);

    for (let i = 0; i < words.length - 4; i++) {
      grams.push(words.slice(i, i + 5).join(' '));
    }

    return grams.length > 0 ? grams : [text];
  }

  private static simpleHash(str: string): bigint {
    let hash = 0n;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5n) - hash) + BigInt(char);
      hash = hash & hash;
    }
    return BigInt(Math.abs(Number(hash)));
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}
