import { useState, useEffect } from 'react';
import { Activity, RefreshCw, AlertCircle, BarChart3, X, AlertTriangle, Zap, ChevronDown, ChevronUp, TrendingUp, Shield, Code, FileText, Brain } from 'lucide-react';
import { SiteAuditResultService, SiteAuditResult } from '../lib/siteAuditResultService';
import { useNotification } from '../components/NotificationContainer';
import { triggerAllAuditsService, TriggerAllAuditsResponse } from '../lib/triggerAllAuditsService';
import TriggerAllAuditsResultModal from '../components/TriggerAllAuditsResultModal';
import PublisherCardSkeleton from '../components/PublisherCardSkeleton';

interface AuditDetailModalProps {
  audit: SiteAuditResult;
  onClose: () => void;
}

function AuditDetailModal({ audit, onClose }: AuditDetailModalProps) {
  if (!audit) return null;

  const style = SiteAuditResultService.getRiskLevelStyle(audit.riskLevel);
  const adMetrics = SiteAuditResultService.getAdMetrics(audit.adAnalysis);
  const contentMetrics = SiteAuditResultService.getContentMetrics(audit.contentAnalysis);
  const issues = SiteAuditResultService.extractIssuesFromAiReport(audit.aiReport);
  const fixes = SiteAuditResultService.extractFixesFromAiReport(audit.aiReport);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#161616] border border-[#2C2C2C] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#161616] border-b border-[#2C2C2C] p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white mb-1">{audit.publisherName}</h2>
            <p className="text-sm text-gray-400">{audit.publisherDomain}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-2xl font-bold text-white">
                MFA Risk Score: {Math.round(audit.riskScore)}/100
              </h3>
              <div
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: style.bg, color: style.color }}
              >
                {style.label}
              </div>
            </div>
            <div className="w-full bg-[#2C2C2C] rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, audit.riskScore))}%`,
                  backgroundColor: style.color,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[#1E1E1E] rounded-lg p-4 border border-[#2C2C2C]">
              <div className="text-xs text-gray-400 mb-2">MFA Probability</div>
              <div className="text-2xl font-bold text-[#48a77f]">{(audit.mfaProbability * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-[#1E1E1E] rounded-lg p-4 border border-[#2C2C2C]">
              <div className="text-xs text-gray-400 mb-2">Content Quality</div>
              <div className="text-2xl font-bold text-purple-400">{Math.round(contentMetrics.readability)}</div>
            </div>
            <div className="bg-[#1E1E1E] rounded-lg p-4 border border-[#2C2C2C]">
              <div className="text-xs text-gray-400 mb-2">Ad Density</div>
              <div className="text-2xl font-bold text-orange-400">{Math.round(adMetrics.density)}</div>
            </div>
            <div className="bg-[#1E1E1E] rounded-lg p-4 border border-[#2C2C2C]">
              <div className="text-xs text-gray-400 mb-2">Technical Health</div>
              <div className="text-2xl font-bold text-[#48a77f]">{Math.round(SiteAuditResultService.getTechnicalScore(audit.technicalCheck))}</div>
            </div>
          </div>


          {audit.aiReport?.interpretation?.summary && typeof audit.aiReport.interpretation.summary === 'string' && (
            <div className="bg-gradient-to-br from-cyan-950/40 to-blue-950/30 border border-cyan-600/40 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-cyan-300">AI Assistance</h3>
              </div>
              <p className="text-sm text-cyan-100/90 leading-relaxed whitespace-pre-wrap">
                {audit.aiReport.interpretation.summary}
              </p>
            </div>
          )}

          {audit.aiReport?.interpretation?.modules && audit.aiReport.interpretation.modules.length > 0 && (
            <div className="bg-gradient-to-br from-[#1E1E1E] to-[#1A1A1A] rounded-lg p-5 border border-[#2C2C2C]">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">AI Module Analysis</h3>
              </div>

              <div className="space-y-4">
                {(audit.aiReport.interpretation.modules || []).map((module: any, idx: number) => (
                  <div key={idx} className="bg-[#161616] rounded-lg p-4 border border-blue-500/20">
                    <h4 className="text-sm font-semibold text-blue-300 mb-3 capitalize">{module.module}</h4>

                    {module.found && module.found.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-orange-400 mb-2">Issues Found:</div>
                        <ul className="space-y-1 ml-3">
                          {module.found.map((item: string, i: number) => (
                            <li key={i} className="text-xs text-gray-300">• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {module.causes && module.causes.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-yellow-400 mb-2">Root Causes:</div>
                        <ul className="space-y-1 ml-3">
                          {module.causes.map((cause: string, i: number) => (
                            <li key={i} className="text-xs text-gray-300">• {cause}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {module.fixes && module.fixes.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-[#48a77f] mb-2">Recommended Fixes:</div>
                        <ul className="space-y-1 ml-3">
                          {module.fixes.map((fix: string, i: number) => (
                            <li key={i} className="text-xs text-gray-300">• {fix}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {module.good && module.good.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-[#48a77f] mb-2">What's Good:</div>
                        <ul className="space-y-1 ml-3">
                          {module.good.map((item: string, i: number) => (
                            <li key={i} className="text-xs text-gray-300">• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {module.summary && (
                      <div className="pt-3 border-t border-blue-500/10">
                        <div className="text-xs font-medium text-gray-400 mb-1">Summary:</div>
                        <p className="text-xs text-gray-300">{module.summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {audit.technicalCheck && (
              <div className="bg-[#1E1E1E] rounded-lg p-5 border border-[#2C2C2C]">
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <Code className="w-5 h-5 mr-2" />
                  Technical Audit
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Health Score</span>
                    <span className="text-white font-medium">{audit.technicalCheck.technicalHealthScore}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Critical Issues</span>
                    <span className="text-red-400">{(audit.technicalCheck.summary?.criticalIssues || []).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Warnings</span>
                    <span className="text-yellow-400">{(audit.technicalCheck.summary?.warnings || []).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Compliance</span>
                    <span className="text-white">{audit.policyCheck?.complianceLevel || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}

            {audit.adAnalysis && (
              <div className="bg-[#1E1E1E] rounded-lg p-5 border border-[#2C2C2C]">
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Ad Analysis
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Density</span>
                    <span className="text-white font-medium">{Math.round(adMetrics.density)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Auto-Refresh</span>
                    <span className="text-white font-medium">{Math.round(adMetrics.refresh)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Visibility</span>
                    <span className="text-white font-medium">{Math.round(adMetrics.visibility)}</span>
                  </div>
                </div>
              </div>
            )}

            {audit.aiReport?.interpretation && (
              <div className="bg-[#1E1E1E] rounded-lg p-5 border border-[#2C2C2C]">
                <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <Brain className="w-5 h-5 mr-2" />
                  AI Report
                </h4>
                <div className="space-y-2 text-sm">
                  {audit.aiReport.interpretation.categorization && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Primary Category</span>
                        <span className="text-white font-medium">{audit.aiReport.interpretation.categorization.primaryCategory || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Confidence</span>
                        <span className="text-white font-medium">{Math.round((audit.aiReport.interpretation.categorization.confidence || 0) * 100)}%</span>
                      </div>
                    </>
                  )}
                  {audit.aiReport.interpretation.modules && audit.aiReport.interpretation.modules.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Modules Analyzed</span>
                      <span className="text-white font-medium">
                        {audit.aiReport.interpretation.modules.length}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {audit.aiReport?.interpretation?.modules && audit.aiReport.interpretation.modules.length > 0 && (() => {
            const modules = audit.aiReport.interpretation.modules || [];
            const allCauses = modules.flatMap((m: any) => m.causes || []);
            const allFixes = modules.flatMap((m: any) => m.fixes || []);

            return (allCauses.length > 0 || allFixes.length > 0) ? (
              <div className="bg-gradient-to-br from-amber-950/40 to-orange-950/30 border border-amber-600/40 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-amber-300 mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Worker Analysis - Root Causes & Fixes
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {allCauses.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-amber-200 flex items-center">
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mr-2"></span>
                        Root Causes
                      </h4>
                      <ul className="space-y-2">
                        {allCauses.map((cause: string, i: number) => (
                          <li key={i} className="text-sm text-amber-100 flex items-start">
                            <span className="mr-3 text-amber-400">→</span>
                            <span>{cause}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {allFixes.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-green-300 flex items-center">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></span>
                        Recommended Fixes
                      </h4>
                      <ul className="space-y-2">
                        {allFixes.map((fix: string, i: number) => (
                          <li key={i} className="text-sm text-green-100 flex items-start">
                            <span className="mr-3 text-green-400">✓</span>
                            <span>{fix}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : null;
          })()}

          {audit.contentAnalysis && (
            <div className="bg-[#1E1E1E] rounded-lg p-5 border border-[#2C2C2C]">
              <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Content Analysis
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 mb-1">Readability</div>
                  <div className="text-xl font-bold text-white">{Math.round(contentMetrics.readability)}</div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Entropy Score</div>
                  <div className="text-xl font-bold text-white">{Math.round(contentMetrics.entropy)}</div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Freshness</div>
                  <div className="text-xl font-bold text-white">{Math.round(contentMetrics.freshness)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#1E1E1E] rounded-lg p-5 border border-[#2C2C2C]">
            <h4 className="text-lg font-semibold text-white mb-3">Audit Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Audit Date</div>
                <div className="text-white">{SiteAuditResultService.formatDate(audit.updatedAt)}</div>
              </div>
              <div>
                <div className="text-gray-400 mb-1">Status</div>
                <div className="text-green-400 capitalize">{audit.status}</div>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-[#48a77f] text-white rounded-lg hover:bg-[#3d9166] transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MFABuster() {
  const [audits, setAudits] = useState<SiteAuditResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<SiteAuditResult | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<TriggerAllAuditsResponse | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const { showSuccess, showError, showInfo, showWarning } = useNotification();

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await SiteAuditResultService.getPublishersWithAudits();
      setAudits(data);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audit data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerAllAudits = async () => {
    try {
      setIsTriggering(true);
      showInfo('Triggering', 'Starting audits for all publishers...');

      const result = await triggerAllAuditsService.triggerAllPublisherAudits();
      setTriggerResult(result);
      setShowResultModal(true);

      if (result.success) {
        showSuccess('Success', `Queued ${result.queuedPublishers} publishers for audit`);
      } else {
        showWarning('Partial Success', `Queued ${result.queuedPublishers}, Failed ${result.failedPublishers}`);
      }
    } catch (err) {
      console.error('Error triggering audits:', err);
      showError('Error', err instanceof Error ? err.message : 'Failed to trigger audits');
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getRiskStats = () => {
    const stats = {
      total: audits.length,
      low: audits.filter(a => a.riskLevel?.toUpperCase() === 'LOW').length,
      medium: audits.filter(a => a.riskLevel?.toUpperCase() === 'MEDIUM').length,
      high: audits.filter(a => a.riskLevel?.toUpperCase() === 'HIGH').length,
      critical: audits.filter(a => a.riskLevel?.toUpperCase() === 'CRITICAL').length,
      avgScore: audits.length > 0
        ? Math.round(audits.reduce((sum, a) => sum + a.riskScore, 0) / audits.length)
        : 0,
    };
    return stats;
  };

  const stats = getRiskStats();

  if (isLoading) {
    return (
      <div className="space-y-6 min-h-screen flex flex-col">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-white mb-1 flex items-center">
                <Activity className="w-6 h-6 mr-3 text-[#48a77f]" />
                MFA Buster
              </h1>
              <p className="text-sm text-gray-400">
                Loading audit data...
              </p>
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gradient-to-br from-[#1E1E1E] to-[#161616] rounded-lg border border-[#2C2C2C] p-4">
                <div className="h-3 bg-[#2C2C2C] rounded w-2/3 mb-2"></div>
                <div className="h-8 bg-[#2C2C2C] rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 pb-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <PublisherCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen flex flex-col">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1 flex items-center">
              <Activity className="w-6 h-6 mr-3 text-[#48a77f]" />
              MFA Buster
            </h1>
            <p className="text-sm text-gray-400">
              Monitor website quality and MFA risk scores
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleTriggerAllAudits}
              disabled={isTriggering || audits.length === 0}
              className="inline-flex items-center px-4 py-2 border border-[#2C2C2C] rounded-lg text-sm font-medium text-white bg-[#48a77f] hover:bg-[#3d9166] disabled:opacity-50 disabled:bg-gray-700 transition-colors"
            >
              <Zap className={`w-4 h-4 mr-2 ${isTriggering ? 'animate-pulse' : ''}`} />
              {isTriggering ? 'Auditing...' : 'Audit All'}
            </button>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-[#2C2C2C] rounded-lg text-sm font-medium text-white bg-[#161616] hover:bg-[#1E1E1E] disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#161616] rounded-lg border border-[#2C2C2C] p-4 hover:border-[#48a77f]/50 transition-colors">
            <div className="text-xs text-gray-400 mb-1 font-medium">Audited</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#161616] rounded-lg border border-[#2C2C2C] p-4 hover:border-[#48a77f]/50 transition-colors">
            <div className="text-xs text-gray-400 mb-1 font-medium">Avg Score</div>
            <div className="text-2xl font-bold text-white">{stats.avgScore}</div>
          </div>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#161616] rounded-lg border border-[#2C2C2C] p-4 hover:border-[#48a77f]/50 transition-colors">
            <div className="text-xs text-gray-400 mb-1 font-medium">Low</div>
            <div className="text-2xl font-bold text-[#48a77f]">{stats.low}</div>
          </div>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#161616] rounded-lg border border-[#2C2C2C] p-4 hover:border-[#48a77f]/50 transition-colors">
            <div className="text-xs text-gray-400 mb-1 font-medium">Medium</div>
            <div className="text-2xl font-bold text-[#FFC107]">{stats.medium}</div>
          </div>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#161616] rounded-lg border border-[#2C2C2C] p-4 hover:border-[#48a77f]/50 transition-colors">
            <div className="text-xs text-gray-400 mb-1 font-medium">High</div>
            <div className="text-2xl font-bold text-[#FF9800]">{stats.high}</div>
          </div>
          <div className="bg-gradient-to-br from-[#1E1E1E] to-[#161616] rounded-lg border border-[#2C2C2C] p-4 hover:border-[#48a77f]/50 transition-colors">
            <div className="text-xs text-gray-400 mb-1 font-medium">Critical</div>
            <div className="text-2xl font-bold text-[#F44336]">{stats.critical}</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-300">Error Loading Data</p>
                <p className="text-xs text-red-400 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 pb-6">
        {audits.map(audit => {
          const style = SiteAuditResultService.getRiskLevelStyle(audit.riskLevel);
          const adMetrics = SiteAuditResultService.getAdMetrics(audit.adAnalysis);
          const issues = SiteAuditResultService.extractIssuesFromAiReport(audit.aiReport);
          const contentMetrics = SiteAuditResultService.getContentMetrics(audit.contentAnalysis);

          // Extract AI report summary and module info
          const aiSummary = audit.aiReport?.interpretation?.summary || null;
          const aiModules = audit.aiReport?.interpretation?.modules || [];
          const aiCategory = audit.aiReport?.interpretation?.categorization?.primaryCategory || null;

          return (
            <div
              key={audit.id}
              className="group bg-gradient-to-br from-[#1E1E1E] to-[#161616] border border-[#2C2C2C] rounded-lg overflow-hidden hover:border-[#48a77f]/50 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => setSelectedAudit(audit)}
            >
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1 line-clamp-1">{audit.publisherName}</h3>
                  <p className="text-sm text-gray-400 line-clamp-1">{audit.publisherDomain}</p>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-4xl font-bold" style={{ color: style.color }}>
                      {Math.round(audit.riskScore)}
                    </span>
                    <span className="text-sm text-gray-400">/100</span>
                  </div>
                  <div className="w-full bg-[#2C2C2C] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, audit.riskScore))}%`,
                        backgroundColor: style.color,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: style.bg, color: style.color }}
                    >
                      {style.label}
                    </div>
                    <span className="text-xs text-gray-500">{audit.status}</span>
                  </div>
                </div>

                {/* AI Category Badge */}
                {aiCategory && (
                  <div className="flex items-center gap-2 text-xs">
                    <Brain className="w-3 h-3 text-cyan-400" />
                    <span className="text-gray-400">Category:</span>
                    <span className="text-cyan-300 font-medium capitalize">{aiCategory}</span>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-[#0a0a0a] rounded p-2 border border-[#2C2C2C]">
                    <div className="text-xs text-gray-500 mb-1">MFA Prob</div>
                    <div className="text-sm font-bold text-white">{(audit.mfaProbability * 100).toFixed(1)}%</div>
                  </div>
                  <div className="bg-[#0a0a0a] rounded p-2 border border-[#2C2C2C]">
                    <div className="text-xs text-gray-500 mb-1">Content</div>
                    <div className="text-sm font-bold text-white">{Math.round(contentMetrics.readability)}</div>
                  </div>
                  <div className="bg-[#0a0a0a] rounded p-2 border border-[#2C2C2C]">
                    <div className="text-xs text-gray-500 mb-1">Ad Density</div>
                    <div className="text-sm font-bold text-white">{Math.round(adMetrics.density)}</div>
                  </div>
                  <div className="bg-[#0a0a0a] rounded p-2 border border-[#2C2C2C]">
                    <div className="text-xs text-gray-500 mb-1">Tech Score</div>
                    <div className="text-sm font-bold text-white">{Math.round(SiteAuditResultService.getTechnicalScore(audit.technicalCheck))}</div>
                  </div>
                </div>

                {/* AI Summary Preview */}
                {aiSummary && typeof aiSummary === 'string' && (
                  <div className="bg-gradient-to-br from-cyan-950/20 to-blue-950/10 border border-cyan-600/20 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span className="text-xs font-semibold text-cyan-300">AI Insights</span>
                      {aiModules.length > 0 && (
                        <span className="ml-auto text-xs text-cyan-400/60">
                          {aiModules.length} module{aiModules.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-cyan-100/80 line-clamp-2 leading-relaxed">
                      {aiSummary}
                    </p>
                  </div>
                )}

                {issues.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2 space-y-1">
                    <div className="flex items-center text-xs text-red-400 font-semibold mb-2">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Top Issues ({issues.length})
                    </div>
                    {issues.slice(0, 2).map((issue, i) => (
                      <p key={i} className="text-xs text-red-300 line-clamp-1">• {issue}</p>
                    ))}
                    {issues.length > 2 && (
                      <p className="text-xs text-red-400/60 italic">+{issues.length - 2} more</p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-[#2C2C2C] pt-3">
                  <span>{SiteAuditResultService.getTimeAgo(audit.updatedAt)}</span>
                  <span className="text-[#48a77f] font-semibold group-hover:translate-x-1 transition-transform">View details →</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {audits.length === 0 && !isLoading && (
        <div className="text-center py-16 bg-[#161616] rounded-lg border border-[#2C2C2C]">
          <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-300 text-lg font-medium">No audit results yet</p>
          <p className="text-gray-500 text-sm mt-2">Click "Audit All" to run comprehensive site audits</p>
        </div>
      )}

      {selectedAudit && (
        <AuditDetailModal
          audit={selectedAudit}
          onClose={() => setSelectedAudit(null)}
        />
      )}

      {triggerResult && (
        <TriggerAllAuditsResultModal
          result={triggerResult}
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
        />
      )}
    </div>
  );
}
