import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { SiteAudit } from '../lib/siteAuditService';

interface AuditDetailsModalProps {
  audit: SiteAudit;
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditDetailsModal({ audit, isOpen, onClose }: AuditDetailsModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const aiReport = audit.ai_report;

  const handleCopyModule = (moduleText: string, index: number) => {
    navigator.clipboard.writeText(moduleText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatModuleOutput = (module: any): string => {
    let output = `### module(${module.module})\n`;

    if (module.found && module.found.length > 0) {
      output += `found(issues:[${module.found.map((item: string) => `"${item}"`).join(', ')}])\n`;
    }

    if (module.causes && module.causes.length > 0) {
      output += `cause:[${module.causes.map((item: string) => `"${item}"`).join(', ')}]\n`;
    }

    if (module.fixes && module.fixes.length > 0) {
      output += `fix:[${module.fixes.map((item: string) => `"${item}"`).join(', ')}]\n`;
    }

    if (module.impact) {
      output += `impact(score_change="${module.impact}")\n`;
    }

    if (module.good && module.good.length > 0) {
      output += `good:[${module.good.map((item: string) => `"${item}"`).join(', ')}]\n`;
    }

    if (module.summary) {
      output += `review_summary("${module.summary}")`;
    }

    return output;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161616] rounded-lg border border-[#2C2C2C] max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#2C2C2C]">
          <h2 className="text-xl font-bold text-white">AI Report Analysis</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {aiReport?.interpretation?.modules && aiReport.interpretation.modules.length > 0 ? (
            <>
              <p className="text-sm text-gray-400 mb-4">
                Raw LLM output from the monitoring worker analysis:
              </p>

              {aiReport.interpretation.modules.map((module: any, index: number) => {
                const moduleOutput = formatModuleOutput(module);
                return (
                  <div
                    key={index}
                    className="bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg p-4 hover:border-[#48a77f]/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-[#48a77f]">
                        {module.module}
                      </h3>
                      <button
                        onClick={() => handleCopyModule(moduleOutput, index)}
                        className="p-1.5 text-gray-400 hover:text-[#48a77f] transition-colors"
                        title="Copy module output"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="font-mono text-xs bg-black/40 rounded p-4 text-gray-300 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                      {moduleOutput}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-400">No AI analysis available yet.</p>
            </div>
          )}
        </div>

        <div className="border-t border-[#2C2C2C] p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
