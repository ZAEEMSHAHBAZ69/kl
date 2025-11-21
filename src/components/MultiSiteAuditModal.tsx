import { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader, CheckCircle, XCircle, Clock } from 'lucide-react';
import { auditBatchService, AuditBatch, AuditJob, SiteNameOption } from '../lib/auditBatchService';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from './NotificationContainer';

interface MultiSiteAuditModalProps {
  publisherId: string;
  publisherName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalStep = 'select' | 'progress' | 'complete';

export default function MultiSiteAuditModal({
  publisherId,
  publisherName,
  isOpen,
  onClose,
  onSuccess,
}: MultiSiteAuditModalProps) {
  const { session } = useAuth();
  const { showError, showSuccess } = useNotification();

  const [step, setStep] = useState<ModalStep>('select');
  const [availableSites, setAvailableSites] = useState<SiteNameOption[]>([]);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<AuditBatch | null>(null);
  const [jobs, setJobs] = useState<AuditJob[]>([]);
  const [isInitiating, setIsInitiating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setAvailableSites([]);
      setSelectedSites(new Set());
      setBatch(null);
      setJobs([]);
      return;
    }

    fetchSiteNames();
  }, [isOpen]);

  const fetchSiteNames = async () => {
    setLoading(true);
    try {
      const sites = await auditBatchService.fetchPublisherSiteNames(publisherId);
      setAvailableSites(sites);

      if (sites.length > 0) {
        const allSites = new Set(sites.map((s) => s.site_name));
        setSelectedSites(allSites);
      }
    } catch (error) {
      console.error('Error fetching site names:', error);
      showError('Error', 'Failed to fetch site names');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSite = (siteName: string) => {
    const newSelected = new Set(selectedSites);
    if (newSelected.has(siteName)) {
      newSelected.delete(siteName);
    } else {
      newSelected.add(siteName);
    }
    setSelectedSites(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSites.size === availableSites.length) {
      setSelectedSites(new Set());
    } else {
      setSelectedSites(new Set(availableSites.map((s) => s.site_name)));
    }
  };

  const handleStartAudit = async () => {
    if (selectedSites.size === 0) {
      showError('Validation', 'Please select at least one site to audit');
      return;
    }

    if (!session) {
      showError('Authentication', 'You must be logged in to start an audit');
      return;
    }

    setIsInitiating(true);
    try {
      const token = session.access_token;
      const result = await auditBatchService.initiateMultiSiteAudit(
        publisherId,
        Array.from(selectedSites),
        token
      );

      if (result.success && result.batchId) {
        setStep('progress');

        const batchData = await auditBatchService.getBatchProgress(result.batchId);
        if (batchData) {
          setBatch(batchData);
        }

        const jobsData = await auditBatchService.getBatchJobs(result.batchId);
        setJobs(jobsData);

        showSuccess('Audit Started', 'Multi-site audit batch has been initiated');

        pollBatchProgress(result.batchId);
      } else {
        showError('Failed', result.error || 'Failed to start audit');
      }
    } catch (error) {
      console.error('Error starting audit:', error);
      showError('Error', error instanceof Error ? error.message : 'Failed to start audit');
    } finally {
      setIsInitiating(false);
    }
  };

  const pollBatchProgress = async (id: string, attempts = 0, maxAttempts = 60) => {
    if (attempts >= maxAttempts) return;

    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const batchData = await auditBatchService.getBatchProgress(id);
      if (batchData) {
        setBatch(batchData);

        if (batchData.status === 'completed' || batchData.status === 'failed') {
          setStep('complete');
          const jobsData = await auditBatchService.getBatchJobs(id);
          setJobs(jobsData);
          return;
        }
      }

      const jobsData = await auditBatchService.getBatchJobs(id);
      setJobs(jobsData);

      pollBatchProgress(id, attempts + 1, maxAttempts);
    } catch (error) {
      console.error('Error polling batch progress:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0E0E0E]/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161616] rounded-[10px] w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#2C2C2C] shadow-2xl">
        <div className="sticky top-0 bg-[#161616] border-b border-[#2C2C2C] p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {step === 'select' && 'Select Sites to Audit'}
            {step === 'progress' && 'Audit in Progress'}
            {step === 'complete' && 'Audit Complete'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {step === 'select' && (
            <div className="space-y-4">
              <div className="bg-[#0E0E0E] rounded-lg p-4 border border-[#2C2C2C]">
                <p className="text-gray-300 mb-4">
                  Select the sites you want to audit for <span className="font-semibold text-white">{publisherName}</span>
                </p>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="w-5 h-5 animate-spin text-[#48a77f]" />
                  </div>
                ) : availableSites.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No sites found for this publisher</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSites.size === availableSites.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-[#2C2C2C] bg-[#1E1E1E] text-[#48a77f] cursor-pointer"
                        />
                        <span className="text-white font-medium">
                          Select All ({availableSites.length})
                        </span>
                      </label>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availableSites.map((site) => (
                        <label
                          key={site.site_name}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1E1E1E] cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSites.has(site.site_name)}
                            onChange={() => handleSelectSite(site.site_name)}
                            className="w-4 h-4 rounded border-[#2C2C2C] bg-[#1E1E1E] text-[#48a77f] cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="text-white font-medium">{site.site_name}</div>
                            <div className="text-xs text-gray-500">
                              {site.count} record{site.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartAudit}
                  disabled={isInitiating || selectedSites.size === 0}
                  className="px-4 py-2 bg-[#48a77f] hover:bg-[#3d9166] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isInitiating ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Start Audit
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'progress' && (
            <div className="space-y-4">
              {batch && (
                <div className="bg-[#0E0E0E] rounded-lg p-4 border border-[#2C2C2C]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Progress</h3>
                    <span className="text-sm text-gray-400">
                      {batch.completed_sites + batch.failed_sites} / {batch.total_sites}
                    </span>
                  </div>
                  <div className="w-full bg-[#1E1E1E] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#48a77f] h-full transition-all duration-300"
                      style={{
                        width: `${
                          batch.total_sites > 0
                            ? ((batch.completed_sites + batch.failed_sites) / batch.total_sites) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="bg-[#0E0E0E] rounded-lg p-4 border border-[#2C2C2C]">
                <h3 className="text-white font-semibold mb-3">Site Status</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {jobs.length > 0 ? (
                    jobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-[#1E1E1E]/50 border border-[#2C2C2C]/50"
                      >
                        {job.status === 'completed' && (
                          <CheckCircle className="w-5 h-5 text-[#48a77f] flex-shrink-0" />
                        )}
                        {job.status === 'failed' && (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                        {job.status === 'in_progress' && (
                          <Loader className="w-5 h-5 text-blue-500 flex-shrink-0 animate-spin" />
                        )}
                        {job.status === 'pending' && (
                          <Clock className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        )}

                        <div className="flex-1">
                          <div className="text-white font-medium">{job.site_name}</div>
                          <div className="text-xs text-gray-500">
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                            {job.mfa_score !== undefined && (
                              <> • MFA Score: {job.mfa_score.toFixed(1)}</>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">Loading site status...</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-4">
              <div className="bg-[#0E0E0E] rounded-lg p-4 border border-[#2C2C2C]">
                <div className="flex items-center gap-3 mb-4">
                  {batch?.status === 'completed' ? (
                    <CheckCircle className="w-8 h-8 text-[#48a77f]" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-orange-500" />
                  )}
                  <div>
                    <h3 className="text-white font-semibold">
                      {batch?.status === 'completed' ? 'Audit Completed' : 'Audit Finished'}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {batch?.completed_sites} successful, {batch?.failed_sites} failed
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-[#1E1E1E] rounded p-3">
                    <div className="text-gray-400 text-xs mb-1">Total Sites</div>
                    <div className="text-2xl font-bold text-white">{batch?.total_sites}</div>
                  </div>
                  <div className="bg-[#1E1E1E] rounded p-3">
                    <div className="text-gray-400 text-xs mb-1">Successful</div>
                    <div className="text-2xl font-bold text-[#48a77f]">{batch?.completed_sites}</div>
                  </div>
                  <div className="bg-[#1E1E1E] rounded p-3">
                    <div className="text-gray-400 text-xs mb-1">Failed</div>
                    <div className="text-2xl font-bold text-red-500">{batch?.failed_sites}</div>
                  </div>
                </div>
              </div>

              <div className="bg-[#0E0E0E] rounded-lg p-4 border border-[#2C2C2C]">
                <h3 className="text-white font-semibold mb-3">Final Results</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#1E1E1E]/50 border border-[#2C2C2C]/50"
                    >
                      {job.status === 'completed' && (
                        <CheckCircle className="w-5 h-5 text-[#48a77f] flex-shrink-0" />
                      )}
                      {job.status === 'failed' && (
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      )}

                      <div className="flex-1">
                        <div className="text-white font-medium">{job.site_name}</div>
                        {job.mfa_score !== undefined && (
                          <div className="text-xs text-gray-500">
                            MFA Score: {job.mfa_score.toFixed(1)}
                          </div>
                        )}
                        {job.error_message && (
                          <div className="text-xs text-red-400">{job.error_message}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white rounded-lg transition-colors"
                >
                  Close
                </button>
                {onSuccess && (
                  <button
                    onClick={() => {
                      onSuccess();
                      onClose();
                    }}
                    className="px-4 py-2 bg-[#48a77f] hover:bg-[#3d9166] text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Done
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
