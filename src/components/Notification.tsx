import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationProps {
  type: NotificationType;
  title: string;
  message?: string;
  onClose: () => void;
  duration?: number;
}

export default function Notification({
  type,
  title,
  message,
  onClose,
  duration = 5000
}: NotificationProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-900',
      borderColor: 'border-green-700',
      iconColor: 'text-green-400',
      titleColor: 'text-green-100',
      messageColor: 'text-green-200'
    },
    error: {
      icon: XCircle,
      bgColor: 'bg-red-900',
      borderColor: 'border-red-700',
      iconColor: 'text-red-400',
      titleColor: 'text-red-100',
      messageColor: 'text-red-200'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-900',
      borderColor: 'border-yellow-700',
      iconColor: 'text-yellow-400',
      titleColor: 'text-yellow-100',
      messageColor: 'text-yellow-200'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-900',
      borderColor: 'border-blue-700',
      iconColor: 'text-blue-400',
      titleColor: 'text-blue-100',
      messageColor: 'text-blue-200'
    }
  };

  const { icon: Icon, bgColor, borderColor, iconColor, titleColor, messageColor } = config[type];

  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg p-4 shadow-lg max-w-md w-full`}>
      <div className="flex items-start">
        <Icon className={`${iconColor} w-5 h-5 mr-3 mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`${titleColor} font-semibold text-sm`}>{title}</p>
          {message && (
            <p className={`${messageColor} text-sm mt-1`}>{message}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
