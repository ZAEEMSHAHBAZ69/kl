export interface SiteAuditData {
  seo_score: number;
  performance_score: number;
  security_score: number;
  accessibility_score: number;
  policy_compliance_score: number;
  ad_density: number;
  content_uniqueness: number;
}

export interface GAMMetricsData {
  match_rate: number;
  viewability: number;
  ctr: number;
  ecpm: number;
  net_revenue: number;
  ad_requests: number;
}

export interface ModelConfidenceScores {
  alibaba: number;
  nvidia: number;
  openai: number;
}

export interface WeightedScoreBreakdown {
  alibaba: {
    score: number;
    confidence: number;
    weight: number;
  };
  nvidia: {
    score: number;
    confidence: number;
    weight: number;
  };
  openai: {
    score: number;
    confidence: number;
    weight: number;
  };
}

export class AIScoringSynthetizer {
  static calculateConfidenceWeightedScore(
    alibabaScore: number,
    alibabaConf: number,
    nvidiaScore: number,
    nvidiaConf: number,
    openaiScore: number,
    openaiConf: number
  ): { score: number; breakdown: WeightedScoreBreakdown } {
    const totalConfidence = alibabaConf + nvidiaConf + openaiConf;

    if (totalConfidence === 0) {
      return { score: 50, breakdown: {} as WeightedScoreBreakdown };
    }

    const weighted =
      (alibabaScore * alibabaConf +
        nvidiaScore * nvidiaConf +
        openaiScore * openaiConf) /
      totalConfidence;

    const breakdown: WeightedScoreBreakdown = {
      alibaba: {
        score: alibabaScore,
        confidence: alibabaConf,
        weight: (alibabaConf / totalConfidence) * 100,
      },
      nvidia: {
        score: nvidiaScore,
        confidence: nvidiaConf,
        weight: (nvidiaConf / totalConfidence) * 100,
      },
      openai: {
        score: openaiScore,
        confidence: openaiConf,
        weight: (openaiConf / totalConfidence) * 100,
      },
    };

    return {
      score: Math.round(weighted * 100) / 100,
      breakdown,
    };
  }

  static gracefulDegradation(
    alibabaScore: number | null,
    alibabaConf: number,
    nvidiaScore: number | null,
    nvidiaConf: number,
    openaiScore: number | null,
    openaiConf: number
  ): {
    score: number;
    usedModels: string[];
    degradationLevel: "none" | "minor" | "major";
  } {
    const availableModels: Array<{ score: number; conf: number; name: string }> = [];

    if (alibabaScore !== null) {
      availableModels.push({ score: alibabaScore, conf: alibabaConf, name: "alibaba" });
    }
    if (nvidiaScore !== null) {
      availableModels.push({ score: nvidiaScore, conf: nvidiaConf, name: "nvidia" });
    }
    if (openaiScore !== null) {
      availableModels.push({ score: openaiScore, conf: openaiConf, name: "openai" });
    }

    if (availableModels.length === 0) {
      return { score: 50, usedModels: [], degradationLevel: "major" };
    }

    const totalConf = availableModels.reduce((sum, m) => sum + m.conf, 0);
    const weightedScore = availableModels.reduce(
      (sum, m) => sum + (m.score * m.conf) / totalConf,
      0
    );

    let degradationLevel: "none" | "minor" | "major" = "none";
    if (availableModels.length === 2) {
      degradationLevel = "minor";
    } else if (availableModels.length === 1) {
      degradationLevel = "major";
    }

    return {
      score: Math.round(weightedScore * 100) / 100,
      usedModels: availableModels.map((m) => m.name),
      degradationLevel,
    };
  }

  static calculateRiskLevel(score: number): "low" | "medium" | "high" | "critical" {
    if (score < 40) return "critical";
    if (score < 55) return "high";
    if (score < 70) return "medium";
    return "low";
  }

  static aggregateSiteQuality(auditData: SiteAuditData): number {
    const scores = [
      auditData.seo_score,
      auditData.performance_score,
      auditData.security_score,
      auditData.accessibility_score,
      auditData.policy_compliance_score,
    ];

    const validScores = scores.filter((s) => s > 0);
    if (validScores.length === 0) return 0;

    return Math.round(validScores.reduce((a, b) => a + b) / validScores.length);
  }

  static aggregateGAMMetrics(gamData: GAMMetricsData): number {
    const weights = {
      match_rate: 0.25,
      viewability: 0.25,
      ctr: 0.2,
      ecpm: 0.15,
      ad_requests: 0.15,
    };

    const score =
      (gamData.match_rate || 0) * weights.match_rate +
      (gamData.viewability || 0) * weights.viewability +
      (gamData.ctr || 0) * weights.ctr +
      ((gamData.ecpm || 0) / 10) * weights.ecpm +
      Math.min((gamData.ad_requests || 0) / 10000, 100) * weights.ad_requests;

    return Math.round(score);
  }

  static detectDataQualityIssues(
    auditData: Partial<SiteAuditData>,
    gamData: Partial<GAMMetricsData> | null
  ): {
    hasIssues: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!auditData) {
      issues.push("Missing site audit data");
    } else {
      const requiredFields = [
        "seo_score",
        "performance_score",
        "security_score",
        "accessibility_score",
      ];
      const missingFields = requiredFields.filter((f) => !(f in auditData));
      if (missingFields.length > 0) {
        issues.push(`Missing audit fields: ${missingFields.join(", ")}`);
      }
    }

    if (!gamData) {
      issues.push("Missing GAM metrics data");
    }

    return {
      hasIssues: issues.length > 0,
      issues,
    };
  }
}
