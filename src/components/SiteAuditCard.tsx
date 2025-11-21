import { useState } from 'react';
import { Activity, CheckCircle, XCircle, AlertCircle, Clock, RefreshCw, Info } from 'lucide-react';
import { SiteAudit, siteAuditService } from '../lib/siteAuditService';
import AuditDetailsModal from './AuditDetailsModal';

interface SiteAuditCardProps {
  audit: SiteAudit | null;
  publisherId: string;
  publisherName: string;
  domain: string;
  onAuditTriggered?: () => void;
}

export function SiteAuditCard({ audit, publisherId, publisherName, domain, onAuditTriggered }: SiteAuditCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleTriggerAudit = async () => {
    setIsLoading(true);
    try {
      alert('Audit functionality is not available at this time.');
      if (onAuditTriggered) {
        onAuditTriggered();
      }
    } catch (error) {
      console.error('Error triggering audit:', error);
      alert('Failed to trigger audit. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!audit) {
    return (
      <div className="bg-[#161616] rounded-lg border border-[#2C2C2C] p-6 hover:border-[#48a77f] transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{publisherName}</h3>
            <p className="text-sm text-gray-400">{domain}</p>
          </div>
          <Activity className="w-6 h-6 text-gray-500" />
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4">No audit data available</p>
          <button
            onClick={handleTriggerAudit}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 bg-[#48a77f] text-white rounded-lg hover:bg-[#3d9166] disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Starting Audit...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 mr-2" />
                Run Audit
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const riskScore = audit.mfa_score ?? (audit.risk_score ? Math.round(audit.risk_score) : null);
  const riskInfo = siteAuditService.getRiskLevel(riskScore);
  const isInProgress = audit.status === 'processing' || audit.status === 'in_progress' || audit.scan_status === 'in_progress';
  const isFailed = audit.status === 'failed' || audit.scan_status === 'failed';
  const contentAnalysis = audit.content_analysis;
  const adAnalysis = audit.ad_analysis;
  const aiReport = audit.ai_report;
  const technicalCheck = audit.technical_check;

  const getRiskColorClasses = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-[#48a77f]/10 text-[#48a77f] border-[#48a77f]/30';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'critical':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  const hasAnalysisData = !!(contentAnalysis || adAnalysis || technicalCheck || aiReport);
  const isDataPending = audit.status === 'completed' && !hasAnalysisData;

  return (
    <div className="bg-[#161616] rounded-lg border border-[#2C2C2C] hover:border-[#48a77f] transition-colors">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{publisherName}</h3>
              {isFailed && (audit.error_message?.toLowerCase().includes('down') ||
                           audit.error_message?.toLowerCase().includes('offline') ||
                           audit.error_message?.toLowerCase().includes('not responding')) && (
                <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded text-xs font-bold text-red-300">
                  OFFLINE
                </span>
              )}
              {isDataPending && (
                <span className="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/40 rounded text-xs font-bold text-yellow-300">
                  PROCESSING RESULTS
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">{audit.domain || audit.site_name || domain}</p>
            <p className="text-xs text-gray-500 mt-1">
              Last scanned: {siteAuditService.formatDate(audit.scanned_at || audit.completed_at || audit.created_at)}
            </p>
          </div>
          <button
            onClick={handleTriggerAudit}
            disabled={isLoading || isInProgress}
            className="p-2 text-gray-400 hover:text-[#48a77f] disabled:opacity-50 transition-colors"
            title="Run new audit"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading || isInProgress ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {isInProgress && (
          <div className="flex items-center justify-center py-8 text-[#48a77f]">
            <RefreshCw className="w-6 h-6 mr-2 animate-spin" />
            <span>Audit in progress...</span>
          </div>
        )}

        {isDataPending && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-300">Processing Audit Results</p>
                <p className="text-xs text-yellow-400 mt-1">
                  The audit has been completed but analysis results are still being processed. Please check back in a few moments.
                </p>
              </div>
            </div>
          </div>
        )}

        {isFailed && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <XCircle className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-red-300">Audit Failed</p>
                  {audit.error_message?.toLowerCase().includes('down') ||
                   audit.error_message?.toLowerCase().includes('offline') ||
                   audit.error_message?.toLowerCase().includes('not responding') ? (
                    <span className="px-2 py-1 bg-red-500/20 border border-red-500/40 rounded text-xs font-semibold text-red-300">
                      WEBSITE OFFLINE
                    </span>
                  ) : null}
                </div>
                {audit.error_message && (
                  <p className="text-xs text-red-400 mt-1">{audit.error_message}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Run a new audit to check if the website is back online.
                </p>
              </div>
            </div>
          </div>
        )}

        {!isInProgress && !isFailed && (
          <>
            {isDataPending ? (
              <div className="mb-6 p-4 bg-gray-800/30 border border-gray-700 rounded-lg text-center">
                <p className="text-sm text-gray-400">
                  Analysis data is being processed. Refresh to see results.
                </p>
              </div>
            ) : (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">MFA Risk Score</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColorClasses(riskInfo.level)}`}>
                    {riskInfo.label}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="flex-1 bg-[#1E1E1E] rounded-full h-3 mr-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        riskInfo.level === 'low' ? 'bg-[#48a77f]' :
                        riskInfo.level === 'medium' ? 'bg-yellow-400' :
                        riskInfo.level === 'high' ? 'bg-orange-400' :
                        'bg-red-400'
                      }`}
                      style={{ width: `${riskScore || 0}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-white min-w-[3rem] text-right">
                    {siteAuditService.formatScore(riskScore)}/100
                  </span>
                </div>

                {audit.score_breakdown && (
                  <div className="mt-3 pt-3 border-t border-[#2C2C2C] text-xs space-y-1">
                    {Object.entries(audit.score_breakdown).map(([key, value]) => {
                      if (typeof value === 'number') {
                        return (
                          <div key={key} className="flex justify-between text-gray-400">
                            <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="text-gray-300 font-medium">{value.toFixed(1)}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            )}

            {!isDataPending && aiReport && (aiReport.data?.interpretation || aiReport.interpretation) && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-xs font-semibold text-blue-300 mb-2">AI Report</div>
                <div className="space-y-1 text-xs">
                  {((aiReport.data?.interpretation?.categorization) || (aiReport.interpretation?.categorization)) && (
                    <>
                      <div className="flex justify-between text-gray-300">
                        <span>Category:</span>
                        <span className="text-blue-300 font-medium">{(aiReport.data?.interpretation?.categorization?.primaryCategory || aiReport.interpretation?.categorization?.primaryCategory) || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Confidence:</span>
                        <span className="text-blue-300 font-medium">{Math.round(((aiReport.data?.interpretation?.categorization?.confidence || aiReport.interpretation?.categorization?.confidence) || 0) * 100)}%</span>
                      </div>
                    </>
                  )}
                  {((aiReport.data?.interpretation?.parsedFindings?.modules && Object.keys(aiReport.data.interpretation.parsedFindings.modules).length > 0) ||
                    (aiReport.interpretation?.modules && aiReport.interpretation.modules.length > 0)) && (
                    <div className="flex justify-between text-gray-300">
                      <span>Modules:</span>
                      <span className="text-blue-300 font-medium">
                        {aiReport.data?.interpretation?.parsedFindings?.modules ? Object.keys(aiReport.data.interpretation.parsedFindings.modules).length : (aiReport.interpretation?.modules?.length || 0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isDataPending && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center text-sm">
                  {(technicalCheck?.ssl?.isValid !== false) ? (
                    <CheckCircle className="w-4 h-4 text-[#48a77f] mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 mr-2" />
                  )}
                  <span className="text-gray-300">SSL Cert</span>
                </div>
                <div className="flex items-center text-sm">
                  {(technicalCheck?.adsTxt?.found !== false) ? (
                    <CheckCircle className="w-4 h-4 text-[#48a77f] mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 mr-2" />
                  )}
                  <span className="text-gray-300">ads.txt</span>
                </div>
                <div className="flex items-center text-sm">
                  {audit.has_privacy_policy ? (
                    <CheckCircle className="w-4 h-4 text-[#48a77f] mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 mr-2" />
                  )}
                  <span className="text-gray-300">Privacy Policy</span>
                </div>
                <div className="flex items-center text-sm">
                  {audit.has_contact_page ? (
                    <CheckCircle className="w-4 h-4 text-[#48a77f] mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 mr-2" />
                  )}
                  <span className="text-gray-300">Contact Page</span>
                </div>
                <div className="flex items-center text-sm">
                  {audit.ads_txt_valid ? (
                    <CheckCircle className="w-4 h-4 text-[#48a77f] mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 mr-2" />
                  )}
                  <span className="text-gray-300">Valid ads.txt</span>
                </div>
                <div className="flex items-center text-sm">
                  {audit.mobile_friendly ? (
                    <CheckCircle className="w-4 h-4 text-[#48a77f] mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 mr-2" />
                  )}
                  <span className="text-gray-300">Mobile Friendly</span>
                </div>
              </div>
            )}

            {!isDataPending && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex-1 text-sm text-[#48a77f] hover:text-[#3d9166] font-medium py-2 transition-colors"
                >
                  {showDetails ? 'Hide Details' : 'Show Details'}
                </button>
                {audit && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="p-2 text-[#48a77f] hover:text-[#3d9166] hover:bg-[#48a77f]/10 rounded-lg transition-colors"
                    title="Full Audit Report"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {showDetails && !isDataPending && (
              <div className="mt-4 pt-4 border-t border-[#2C2C2C] space-y-6">
                <div className="space-y-3 text-sm">
                  <div className="font-semibold text-gray-200 mb-3">Content Analysis</div>
                  <div className="flex justify-between items-center py-2 border-b border-[#2C2C2C]">
                    <span className="text-gray-400 font-medium">Content Length:</span>
                    <span className="text-white font-semibold">{contentAnalysis?.wordCount || audit.content_length || 'N/A'} words</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#2C2C2C]">
                    <span className="text-gray-400 font-medium">Uniqueness:</span>
                    <span className="text-white font-semibold">
                      {contentAnalysis?.uniqueness !== undefined ? `${(contentAnalysis.uniqueness * 100).toFixed(0)}%` :
                       audit.content_uniqueness ? `${audit.content_uniqueness.toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#2C2C2C]">
                    <span className="text-gray-400 font-medium">AI-Generated Likelihood:</span>
                    <span className="text-white font-semibold">
                      {contentAnalysis?.aiLikelihood !== undefined ? `${(contentAnalysis.aiLikelihood * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400 font-medium">Readability Score:</span>
                    <span className="text-white font-semibold">
                      {contentAnalysis?.readability !== undefined ? `${(contentAnalysis.readability * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="font-semibold text-gray-200 mb-3">Ad Analysis</div>
                  <div className="flex justify-between items-center py-2 border-b border-[#2C2C2C]">
                    <span className="text-gray-400 font-medium">Ad Density:</span>
                    <span className="text-white font-semibold">
                      {adAnalysis?.density !== undefined ? `${(adAnalysis.density * 100).toFixed(2)}%` :
                       audit.ad_density ? `${audit.ad_density.toFixed(2)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#2C2C2C]">
                    <span className="text-gray-400 font-medium">Ad Slots Detected:</span>
                    <span className="text-white font-semibold">{adAnalysis?.adSlotCount || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400 font-medium">Scroll Jacking:</span>
                    <span className={`font-semibold ${adAnalysis?.scrollJackingDetected ? 'text-red-400' : 'text-[#48a77f]'}`}>
                      {adAnalysis?.scrollJackingDetected ? 'Detected' : 'Not Detected'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="font-semibold text-gray-200 mb-3">Technical Health</div>
                  <div className="flex justify-between items-center py-2 border-b border-[#2C2C2C]">
                    <span className="text-gray-400 font-medium">Page Speed:</span>
                    <span className="text-white font-semibold">
                      {technicalCheck?.performanceScore ? `${Math.round(technicalCheck.performanceScore)}/100` :
                       audit.page_speed_score ? `${audit.page_speed_score}/100` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#2C2C2C]">
                    <span className="text-gray-400 font-medium">Load Time:</span>
                    <span className="text-white font-semibold">
                      {technicalCheck?.loadTime ? `${(technicalCheck.loadTime / 1000).toFixed(2)}s` :
                       audit.load_time ? `${audit.load_time.toFixed(2)}s` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#2C2C2C]">
                    <span className="text-gray-400 font-medium">Broken Links:</span>
                    <span className="text-white font-semibold">{technicalCheck?.brokenLinks || audit.broken_links || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400 font-medium">Popups:</span>
                    <span className="text-white font-semibold">{technicalCheck?.popupCount || audit.popups_detected || 0}</span>
                  </div>
                </div>

                {aiReport?.interpretation && (
                  <div className="space-y-3 text-sm bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                    <div className="font-semibold text-gray-200 mb-3">AI Analysis</div>
                    <div className="flex justify-between items-center py-2 border-b border-blue-500/10">
                      <span className="text-gray-400 font-medium">Category:</span>
                      <span className="text-blue-300 font-semibold">
                        {aiReport.interpretation?.categorization?.primaryCategory || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400 font-medium">Confidence:</span>
                      <span className="text-blue-300 font-semibold">
                        {aiReport.interpretation?.categorization?.confidence ? `${Math.round(aiReport.interpretation.categorization.confidence * 100)}%` : 'N/A'}
                      </span>
                    </div>
                    {aiReport.llmResponse && (
                      <div className="mt-3 pt-3 border-t border-blue-500/10">
                        <div className="text-gray-300 text-xs max-h-24 overflow-y-auto">
                          {aiReport.llmResponse.substring(0, 300)}...
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {aiReport?.modules && aiReport.modules.length > 0 && (
                  <div className="space-y-4 text-sm">
                    {aiReport.modules.map((module: any, idx: number) => (
                      <div key={idx} className="border border-blue-500/20 rounded-lg p-4 bg-blue-500/5">
                        <div className="font-semibold text-blue-300 mb-3 capitalize">{module.module} Analysis</div>

                        {module.good && module.good.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-medium text-[#48a77f] mb-2 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              What's Good
                            </div>
                            <div className="space-y-1 ml-5">
                              {module.good.map((item: string, goodIdx: number) => (
                                <div key={goodIdx} className="text-gray-300 text-xs">{item}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {module.causes && module.causes.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-medium text-orange-400 mb-2 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Issues Detected
                            </div>
                            <div className="space-y-1 ml-5">
                              {module.causes.map((cause: string, causeIdx: number) => (
                                <div key={causeIdx} className="text-gray-300 text-xs">{cause}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {module.fixes && module.fixes.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-medium text-[#48a77f] mb-2 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Recommended Fixes
                            </div>
                            <div className="space-y-1 ml-5">
                              {module.fixes.map((fix: string, fixIdx: number) => (
                                <div key={fixIdx} className="text-gray-300 text-xs">{fix}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(module.impact || module.summary) && (
                          <div className="pt-2 border-t border-blue-500/10">
                            {module.impact && (
                              <div className="text-xs text-gray-400 mb-1">
                                <span className="text-blue-300 font-medium">Impact:</span> {module.impact}
                              </div>
                            )}
                            {module.summary && (
                              <div className="text-xs text-gray-400">
                                <span className="text-blue-300 font-medium">Summary:</span> {module.summary}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {audit.causes && audit.causes.length > 0 && (
                  <div className="space-y-3 text-sm bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
                    <div className="font-semibold text-gray-200 mb-3">Issues Detected</div>
                    <div className="space-y-2">
                      {audit.causes.map((cause: any, idx: number) => (
                        <div key={idx} className="text-gray-300 text-xs pb-2 border-b border-orange-500/10 last:border-0">
                          {typeof cause === 'string' ? cause : cause.title || JSON.stringify(cause)}
                          {typeof cause === 'object' && cause.description && (
                            <p className="text-gray-500 mt-1">{cause.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {audit.fixes && audit.fixes.length > 0 && (
                  <div className="space-y-3 text-sm bg-[#48a77f]/5 border border-[#48a77f]/20 rounded-lg p-4">
                    <div className="font-semibold text-gray-200 mb-3">Recommended Fixes</div>
                    <div className="space-y-2">
                      {audit.fixes.map((fix: any, idx: number) => (
                        <div key={idx} className="text-gray-300 text-xs pb-2 border-b border-[#48a77f]/10 last:border-0">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="w-3 h-3 text-[#48a77f] mt-0.5 flex-shrink-0" />
                            <div>
                              <p>{typeof fix === 'string' ? fix : fix.title || JSON.stringify(fix)}</p>
                              {typeof fix === 'object' && fix.description && (
                                <p className="text-gray-500 mt-1">{fix.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {audit && <AuditDetailsModal audit={audit} isOpen={showModal} onClose={() => setShowModal(false)} />}
    </div>
  );
}
