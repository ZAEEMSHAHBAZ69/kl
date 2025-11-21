import { X, CheckCircle, AlertCircle, Copy, Download } from 'lucide-react';
import { TriggerAllAuditsResponse } from '../lib/triggerAllAuditsService';

interface TriggerAllAuditsResultModalProps {
  result: TriggerAllAuditsResponse;
  isOpen: boolean;
  onClose: () => void;
}

export default function TriggerAllAuditsResultModal({
  result,
  isOpen,
  onClose,
}: TriggerAllAuditsResultModalProps) {
  if (!isOpen) return null;

  const handleCopyResults = () => {
    const text = result.results
      .map(r => `${r.publisherName}: ${r.status}${r.error ? ` (${r.error})` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  const handleDownloadReport = () => {
    const csv = [
      'Publisher ID,Publisher Name,Status,Error',
      ...result.results.map(r =>
        `${r.publisherId},"${r.publisherName}",${r.status},"${r.error || ''}"`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trigger-results-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#161616] border border-[#2C2C2C] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#161616] border-b border-[#2C2C2C] p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">
              Audit Trigger Results
            </h2>
            <p className="text-sm text-gray-400">
              Completed at {new Date().toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1E1E1E] rounded-lg border border-[#2C2C2C] p-4">
              <div className="text-xs text-gray-400 mb-1">Total Publishers</div>
              <div className="text-2xl font-semibold text-white">
                {result.totalPublishers}
              </div>
            </div>
            <div className="bg-[#1E1E1E] rounded-lg border border-[#2C2C2C] p-4">
              <div className="text-xs text-gray-400 mb-1 flex items-center">
                <CheckCircle className="w-3 h-3 mr-2 text-[#48a77f]" />
                Queued
              </div>
              <div className="text-2xl font-semibold text-[#48a77f]">
                {result.queuedPublishers}
              </div>
            </div>
            <div className="bg-[#1E1E1E] rounded-lg border border-[#2C2C2C] p-4">
              <div className="text-xs text-gray-400 mb-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-2 text-[#FF9800]" />
                Failed
              </div>
              <div className="text-2xl font-semibold text-[#FF9800]">
                {result.failedPublishers}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Publisher Details</h3>
            <div className="bg-[#1E1E1E] rounded-lg border border-[#2C2C2C] overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                {result.results.map((r, idx) => (
                  <div
                    key={idx}
                    className={`p-3 border-b border-[#2C2C2C] last:border-b-0 flex items-start justify-between ${
                      r.status === 'queued' ? 'bg-[#0a3d2a]/20' : 'bg-[#3d2a0a]/20'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">
                        {r.publisherName}
                      </div>
                      {r.error && (
                        <div className="text-xs text-[#FF9800] mt-1">
                          {r.error}
                        </div>
                      )}
                    </div>
                    <div
                      className={`ml-3 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                        r.status === 'queued'
                          ? 'bg-[#48a77f] text-white'
                          : 'bg-[#FF9800] text-white'
                      }`}
                    >
                      {r.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCopyResults}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-[#2C2C2C] rounded-lg text-sm font-medium text-white bg-[#1E1E1E] hover:bg-[#2C2C2C] transition-colors"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Results
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-[#2C2C2C] rounded-lg text-sm font-medium text-white bg-[#1E1E1E] hover:bg-[#2C2C2C] transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[#48a77f] text-white rounded-lg hover:bg-[#3d9166] transition-colors font-medium text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
