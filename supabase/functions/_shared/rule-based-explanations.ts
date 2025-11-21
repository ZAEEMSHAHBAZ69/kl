export interface AuditMetrics {
  content_length: number;
  content_uniqueness: number;
  has_privacy_policy: boolean;
  has_contact_page: boolean;
  ad_density: number;
  auto_refresh_ads: boolean;
  ads_above_fold: number;
  sticky_ads_count: number;
  seo_score: number;
  performance_score: number;
  accessibility_score: number;
  security_score: number;
  mobile_friendly: boolean;
  page_speed_score: number;
  ssl_valid: boolean;
}

export interface CategoryAnalysis {
  category: string;
  score_justification: string;
  root_cause: string;
  specific_recommendation: string;
  priority_level: "critical" | "high" | "medium" | "low";
}

export class RuleBasedExplainer {
  generateExplanation(category: string, metrics: AuditMetrics): CategoryAnalysis {
    switch (category) {
      case "content_quality":
        return this.analyzeContentQuality(metrics);
      case "ad_compliance":
        return this.analyzeAdCompliance(metrics);
      case "technical_quality":
        return this.analyzeTechnicalQuality(metrics);
      case "seo_engagement":
        return this.analyzeSEOEngagement(metrics);
      default:
        return this.defaultAnalysis(category);
    }
  }

  private analyzeContentQuality(metrics: AuditMetrics): CategoryAnalysis {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let priority: "critical" | "high" | "medium" | "low" = "low";
    let riskLevel = 0;

    if (metrics.content_length < 300) {
      issues.push("Content is too short (under 300 characters minimum) - increases MFA risk by 0.30");
      recommendations.push("Expand content to at least 300 characters to reduce fraud risk");
      priority = "high";
      riskLevel += 0.30;
    } else if (metrics.content_length < 500) {
      issues.push("Content is below optimal length (500+ characters recommended) - increases risk by 0.15");
      recommendations.push("Add 100+ more characters of original content");
      riskLevel += 0.15;
    }

    if (metrics.content_uniqueness < 60) {
      issues.push(`Content uniqueness is ${metrics.content_uniqueness}% (60% minimum) - increases MFA risk by 0.25`);
      recommendations.push(
        `Increase uniqueness to at least 60% by adding original analysis`
      );
      priority = priority === "low" ? "medium" : priority;
      riskLevel += 0.25;
    } else if (metrics.content_uniqueness < 80) {
      issues.push(
        `Content uniqueness ${metrics.content_uniqueness}% could be improved - increases risk by 0.10`
      );
      recommendations.push("Add more original insights and analysis");
      riskLevel += 0.10;
    }

    if (!metrics.has_privacy_policy) {
      issues.push("Missing privacy policy");
      recommendations.push("Add a clear privacy policy page");
      priority = "critical";
    }

    if (!metrics.has_contact_page) {
      issues.push("Missing contact/about page");
      recommendations.push("Create a contact or about page");
      priority = "critical";
    }

    const justification =
      issues.length === 0
        ? "Content meets quality standards with adequate length and uniqueness"
        : `Content issues identified: ${issues.slice(0, 2).join(", ")}`;

    const rootCause =
      issues.length === 0
        ? "Strong content foundation established"
        : issues.length === 1
        ? issues[0]
        : `Multiple content quality issues: ${issues.join("; ")}`;

    return {
      category: "content_quality",
      score_justification: justification,
      root_cause: rootCause,
      specific_recommendation: recommendations.join("; "),
      priority_level: priority,
    };
  }

  private analyzeAdCompliance(metrics: AuditMetrics): CategoryAnalysis {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let priority: "critical" | "high" | "medium" | "low" = "low";
    let riskLevel = 0;

    if (metrics.auto_refresh_ads) {
      issues.push("Auto-refresh ads detected (CRITICAL: violates Google Ad Exchange policies) - increases MFA risk by 0.40");
      recommendations.push("Remove all auto-refresh ad scripts immediately");
      priority = "critical";
      riskLevel += 0.40;
    }

    if (metrics.ad_density > 50) {
      issues.push(`Ad density is ${metrics.ad_density}% (exceeds 50% threshold) - increases MFA risk by 0.30`);
      recommendations.push("Reduce ad density to under 30%");
      priority = priority === "low" ? "high" : priority;
      riskLevel += 0.30;
    } else if (metrics.ad_density > 30) {
      issues.push(`Ad density is ${metrics.ad_density}% (above 30% recommended) - increases MFA risk by 0.20`);
      recommendations.push("Reduce ad density to improve user experience");
      priority = priority === "low" ? "medium" : priority;
      riskLevel += 0.20;
    }

    if (metrics.ads_above_fold > 5) {
      issues.push(`Too many above-fold ads (${metrics.ads_above_fold}) - increases MFA risk by 0.25`);
      recommendations.push("Limit above-fold ads to 2-3 maximum");
      riskLevel += 0.25;
    }

    if (metrics.sticky_ads_count > 2) {
      issues.push(`Excessive sticky ads (${metrics.sticky_ads_count}) - increases MFA risk by 0.15`);
      recommendations.push("Reduce sticky ads to 1-2 maximum");
      riskLevel += 0.15;
    }

    const justification =
      issues.length === 0
        ? "Ad placement and density comply with policies"
        : `Ad compliance issues detected: ${issues.slice(0, 2).join(", ")}`;

    const rootCause =
      issues.length === 0
        ? "Ad implementation follows best practices"
        : issues[0];

    return {
      category: "ad_compliance",
      score_justification: justification,
      root_cause: rootCause,
      specific_recommendation: recommendations.join("; ") || "No changes needed",
      priority_level: priority,
    };
  }

  private analyzeTechnicalQuality(metrics: AuditMetrics): CategoryAnalysis {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let priority: "critical" | "high" | "medium" | "low" = "low";
    let riskLevel = 0;

    if (!metrics.ssl_valid) {
      issues.push("SSL certificate missing or invalid (CRITICAL) - increases MFA risk by 0.30");
      recommendations.push("Install and configure a valid SSL certificate");
      priority = "critical";
      riskLevel += 0.30;
    }

    if (!metrics.mobile_friendly) {
      issues.push("Website is not mobile friendly - increases MFA risk by 0.15");
      recommendations.push("Implement responsive design for mobile devices");
      priority = priority === "low" ? "high" : priority;
      riskLevel += 0.15;
    }

    if (metrics.performance_score < 50) {
      issues.push(`Performance score ${metrics.performance_score}/100 is poor - increases MFA risk by 0.15`);
      recommendations.push("Optimize images, enable caching, and reduce bloat");
      priority = priority === "low" ? "high" : priority;
      riskLevel += 0.15;
    } else if (metrics.performance_score < 70) {
      issues.push(`Performance score ${metrics.performance_score}/100 needs improvement - increases MFA risk by 0.10`);
      recommendations.push("Optimize images and enable browser caching");
      priority = priority === "low" ? "medium" : priority;
      riskLevel += 0.10;
    }

    if (metrics.page_speed_score > 3000) {
      issues.push(`Page load time ${(metrics.page_speed_score / 1000).toFixed(1)}s is slow - increases MFA risk by 0.10`);
      recommendations.push("Reduce load time to under 2.5 seconds");
      priority = priority === "low" ? "medium" : priority;
      riskLevel += 0.10;
    }

    if (metrics.accessibility_score < 70) {
      issues.push(`Accessibility score ${metrics.accessibility_score}/100 is below standard - increases MFA risk by 0.10`);
      recommendations.push("Improve alt text, contrast ratios, and keyboard navigation");
      priority = priority === "low" ? "medium" : priority;
      riskLevel += 0.10;
    }

    const justification =
      issues.length === 0
        ? "Technical implementation meets quality standards"
        : `Technical issues: ${issues.slice(0, 2).join(", ")}`;

    const rootCause =
      issues.length === 0
        ? "Strong technical foundation"
        : issues[0];

    return {
      category: "technical_quality",
      score_justification: justification,
      root_cause: rootCause,
      specific_recommendation: recommendations.join("; ") || "No changes needed",
      priority_level: priority,
    };
  }

  private analyzeSEOEngagement(metrics: AuditMetrics): CategoryAnalysis {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let priority: "critical" | "high" | "medium" | "low" = "low";

    if (metrics.seo_score < 50) {
      issues.push(`SEO score ${metrics.seo_score}/100 is poor`);
      recommendations.push("Improve meta tags, headers, and content structure");
      priority = "high";
    } else if (metrics.seo_score < 70) {
      issues.push(`SEO score ${metrics.seo_score}/100 needs improvement`);
      recommendations.push("Optimize meta descriptions and add structured data");
      priority = priority === "low" ? "medium" : priority;
    }

    if (metrics.accessibility_score < 70) {
      issues.push(`Accessibility ${metrics.accessibility_score}/100 impacts SEO`);
      recommendations.push("Improve accessibility to boost SEO rankings");
      priority = priority === "low" ? "medium" : priority;
    }

    const justification =
      issues.length === 0
        ? "SEO implementation is solid with good engagement signals"
        : `SEO gaps identified: ${issues.join(", ")}`;

    const rootCause =
      issues.length === 0
        ? "Strong SEO fundamentals established"
        : issues[0];

    return {
      category: "seo_engagement",
      score_justification: justification,
      root_cause: rootCause,
      specific_recommendation: recommendations.join("; ") || "Maintain current optimization efforts",
      priority_level: priority,
    };
  }

  private defaultAnalysis(category: string): CategoryAnalysis {
    return {
      category,
      score_justification: "Analysis category not recognized",
      root_cause: "Unable to assess this category",
      specific_recommendation: "Please contact support for custom analysis",
      priority_level: "low",
    };
  }

  generateAllExplanations(metrics: AuditMetrics): CategoryAnalysis[] {
    return [
      this.analyzeContentQuality(metrics),
      this.analyzeAdCompliance(metrics),
      this.analyzeTechnicalQuality(metrics),
      this.analyzeSEOEngagement(metrics),
    ];
  }
}
