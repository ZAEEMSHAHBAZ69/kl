import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  entityType: 'publisher' | 'partner' | 'user' | 'invitation' | 'mcm_parent';
  entityName: string;
  warningLevel: 'medium' | 'high' | 'critical' | 'warning';
  affectedData?: {
    publishers?: number;
    users?: number;
    reports?: number;
    alerts?: number;
  };
  isLoading?: boolean;
  actionType?: 'delete' | 'action';
  confirmButtonText?: string;
  requireTyping?: boolean;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  entityName,
  warningLevel,
  isLoading = false,
  actionType = 'delete',
  confirmButtonText,
  requireTyping = true
}) => {
  const [confirmText, setConfirmText] = useState('');

  const requiredConfirmText = actionType === 'delete'
    ? `DELETE ${entityName.toUpperCase()}`
    : entityName.toUpperCase();
  const isConfirmValid = requireTyping ? confirmText === requiredConfirmText : true;

  const warningConfig = {
    warning: {
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-900/20',
      borderColor: 'border-yellow-700',
      icon: AlertTriangle
    },
    medium: {
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-900/20',
      borderColor: 'border-yellow-700',
      icon: AlertTriangle
    },
    high: {
      color: 'text-orange-400',
      bgColor: 'bg-orange-900/20',
      borderColor: 'border-orange-700',
      icon: AlertTriangle
    },
    critical: {
      color: 'text-red-400',
      bgColor: 'bg-red-900/20',
      borderColor: 'border-red-700',
      icon: AlertTriangle
    }
  };

  const config = warningConfig[warningLevel];
  const IconComponent = config.icon;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-[#161616] rounded-lg shadow-xl max-w-md w-full mx-4 border border-[#2C2C2C]">
        <div className="flex items-center justify-between p-6 border-b border-[#2C2C2C]">
          <div className="flex items-center space-x-3">
            <IconComponent className={`w-6 h-6 ${config.color}`} />
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className={`p-4 rounded-lg ${config.bgColor} ${config.borderColor} border`}>
            <p className={`text-sm ${config.color} font-medium leading-relaxed`}>
              {message}
            </p>
          </div>

          {actionType === 'delete' && (
            <div className="bg-red-900/20 border border-red-700 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-red-400 mb-2">
                Warning: Permanent Deletion
              </h4>
              <p className="text-sm text-red-300">
                This action is immediate and irreversible. All associated data will be permanently removed from the database.
              </p>
            </div>
          )}

          {requireTyping && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Type <code className={`bg-[#1E1E1E] px-2 py-1 rounded font-mono text-xs ${actionType === 'delete' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {requiredConfirmText}
                </code> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className={`w-full px-3 py-2 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg text-white focus:outline-none focus:ring-2 ${actionType === 'delete' ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-yellow-500 focus:border-yellow-500'}`}
                placeholder="Type confirmation text..."
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-[#2C2C2C] bg-[#161616]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg hover:bg-[#2C2C2C] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmValid || isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors ${
              isConfirmValid && !isLoading
                ? actionType === 'delete'
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-[#48a77f] hover:bg-[#3d9166] focus:ring-[#48a77f]'
                : 'bg-[#2C2C2C] cursor-not-allowed opacity-50'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {actionType === 'delete' ? 'Deleting...' : 'Processing...'}
              </div>
            ) : (
              confirmButtonText || (actionType === 'delete' ? 'Delete Permanently' : 'Confirm')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
